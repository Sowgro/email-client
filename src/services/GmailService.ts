export interface ParsedMessage {
    id?: string;
    sender?: string;
    subject?: string;
    date?: string;
    preview: string;
    html?: string;
    text?: string;
    labelIds: string[];
    starred: boolean;
    unread: boolean;
    attachments: ParsedAttachment[];
    bundleLabelId?: string;
    bundleTitle?: string;
    bundleSummary?: BundleSummary;
}

export interface BundleSummary {
    count: number;
    hasMore: boolean;
    senders: string[];
}

export interface ParsedAttachment {
    id?: string;
    filename: string;
    mimeType?: string;
    size?: number;
}

export interface MessagePage {
    messages: ParsedMessage[];
    nextPageToken?: string;
}

export interface MessageListOptions {
    pageToken?: string;
    query?: string;
    labelIds?: string[];
    includeSpamTrash?: boolean;
    includeBundleSummaries?: boolean;
}

export interface BundleLabel {
    id: string;
    name: string;
    key: string;
    title?: string;
}

export class GmailApiError extends Error {
    public readonly status?: number;
    public readonly isAuthError: boolean;

    constructor(error: unknown) {
        super(getErrorMessage(error));
        this.name = 'GmailApiError';
        this.status = getErrorStatus(error);
        this.isAuthError = this.status === 401 || this.status === 403;
    }
}

const metadataHeaders = ['From', 'Subject', 'Date'];
const BUNDLE_LABEL_PREFIX = 'Fettuccemail/Bundles/';
const BUNDLE_TITLE_SEPARATOR = '::';
const MAX_BUNDLE_LABEL_LENGTH = 225;
const BUNDLE_SUMMARY_LIMIT = 25;

export async function listMessagePage(options: MessageListOptions = {}): Promise<MessagePage> {
    try {
        const [listResponse, bundleLabels] = await Promise.all([
            gapi.client.gmail.users.messages.list({
                userId: 'me',
                maxResults: 25,
                pageToken: options.pageToken,
                q: options.query || undefined,
                labelIds: options.labelIds,
                includeSpamTrash: options.includeSpamTrash,
            }),
            listBundleLabels(),
        ]);

        const messageRefs = listResponse.result.messages ?? [];
        let messages = await Promise.all(messageRefs.filter((message) => message.id).map(async (message) => {
            const fullMessage = await gapi.client.gmail.users.messages.get({
                userId: 'me',
                id: message.id!,
                format: 'full',
                metadataHeaders,
            });

            return parseMessage(fullMessage.result, bundleLabels);
        }));

        if (options.includeBundleSummaries !== false) {
            const summaries = await loadBundleSummaries(messages);
            messages = messages.map((message) => ({
                ...message,
                bundleSummary: message.bundleLabelId
                    ? summaries.get(message.bundleLabelId)
                    : undefined,
            }));
        }

        return {
            messages,
            nextPageToken: listResponse.result.nextPageToken,
        };
    } catch (error) {
        throw new GmailApiError(error);
    }
}

async function loadBundleSummaries(messages: ParsedMessage[]): Promise<Map<string, BundleSummary>> {
    const bundleLabelIds = new Set(
        messages.flatMap((message) => message.bundleLabelId ? [message.bundleLabelId] : [])
    );
    const knownMessages = new Map(
        messages.flatMap((message) => message.id ? [[message.id, message] as const] : [])
    );
    const summaries = await Promise.all(
        [...bundleLabelIds].map(async (bundleLabelId) => {
            const response = await gapi.client.gmail.users.messages.list({
                userId: 'me',
                maxResults: BUNDLE_SUMMARY_LIMIT,
                labelIds: [bundleLabelId],
                includeSpamTrash: true,
            });
            const messageRefs = response.result.messages?.filter((message) => message.id) ?? [];
            const senders = await Promise.all(messageRefs.map(async ({id}) => {
                const knownMessage = knownMessages.get(id!);
                if (knownMessage) {
                    return knownMessage.sender ?? 'Unknown sender';
                }

                const messageResponse = await gapi.client.gmail.users.messages.get({
                    userId: 'me',
                    id: id!,
                    format: 'metadata',
                    metadataHeaders: ['From'],
                });
                return getHeader(messageResponse.result, 'From') ?? 'Unknown sender';
            }));

            return [bundleLabelId, {
                count: messageRefs.length,
                hasMore: Boolean(response.result.nextPageToken),
                senders,
            }] as const;
        })
    );

    return new Map(summaries);
}

export function parseMessage(
    message: gapi.client.gmail.Message,
    bundleLabels: ReadonlyMap<string, BundleLabel> = new Map(),
): ParsedMessage {
    const htmlBodies: string[] = [];
    const textBodies: string[] = [];
    const attachments: ParsedAttachment[] = [];

    collectMessageParts(message.payload, htmlBodies, textBodies, attachments);

    const bundleLabelId = message.labelIds?.find((labelId) => bundleLabels.has(labelId));
    const bundleLabel = bundleLabelId ? bundleLabels.get(bundleLabelId) : undefined;

    return {
        id: message.id,
        sender: getHeader(message, 'From'),
        subject: getHeader(message, 'Subject'),
        date: getHeader(message, 'Date'),
        preview: decodeHtmlEntities(message.snippet ?? '').substring(0, 200),
        html: htmlBodies.join('<hr>') || undefined,
        text: textBodies.join('\n\n') || undefined,
        labelIds: message.labelIds ?? [],
        starred: message.labelIds?.includes('STARRED') ?? false,
        unread: message.labelIds?.includes('UNREAD') ?? false,
        attachments,
        bundleLabelId,
        bundleTitle: bundleLabel?.title,
    };
}

export async function createBundle(
    source: ParsedMessage,
    target: ParsedMessage,
    title?: string,
): Promise<void> {
    if (!source.id || !target.id) {
        throw new GmailApiError(new Error('Both messages must have an ID to create a bundle.'));
    }

    if (source.id === target.id) {
        throw new GmailApiError(new Error('A message cannot be bundled with itself.'));
    }

    if (source.bundleLabelId) {
        throw new GmailApiError(new Error('Only individual messages can be dragged into a bundle.'));
    }

    if (target.bundleLabelId) {
        await modifyMessageLabels(source.id, [target.bundleLabelId]);
        return;
    }

    const labelName = buildBundleLabelName(crypto.randomUUID(), title);
    let createdLabelId: string | undefined;

    try {
        const response = await gapi.client.gmail.users.labels.create({
            userId: 'me',
            resource: {
                name: labelName,
                labelListVisibility: 'labelHide',
                messageListVisibility: 'hide',
            },
        });

        if (!response.result.id || !response.result.name) {
            throw new Error('Gmail did not return the new bundle label.');
        }

        createdLabelId = response.result.id;
        await gapi.client.gmail.users.messages.batchModify({
            userId: 'me',
            resource: {
                ids: [source.id, target.id],
                addLabelIds: [createdLabelId],
            },
        });
        return;
    } catch (error) {
        if (createdLabelId) {
            try {
                await gapi.client.gmail.users.labels.delete({userId: 'me', id: createdLabelId});
            } catch {
                // The unused label is harmless if Gmail rejects cleanup.
            }
        }
        throw new GmailApiError(error);
    }
}

export async function renameBundle(bundleLabelId: string, title: string): Promise<void> {
    try {
        const bundleLabel = (await listBundleLabels()).get(bundleLabelId);
        if (!bundleLabel) {
            throw new Error('The bundle label no longer exists.');
        }

        await gapi.client.gmail.users.labels.patch({
            userId: 'me',
            id: bundleLabelId,
            resource: {name: buildBundleLabelName(bundleLabel.key, title)},
        });
    } catch (error) {
        throw new GmailApiError(error);
    }
}

async function listBundleLabels(): Promise<Map<string, BundleLabel>> {
    try {
        const response = await gapi.client.gmail.users.labels.list({userId: 'me'});
        const labels = new Map<string, BundleLabel>();

        for (const label of response.result.labels ?? []) {
            if (label.id && label.name?.startsWith(BUNDLE_LABEL_PREFIX)) {
                const parsedLabel = parseBundleLabel(label.id, label.name);
                if (parsedLabel) {
                    labels.set(label.id, parsedLabel);
                }
            }
        }

        return labels;
    } catch (error) {
        throw new GmailApiError(error);
    }
}

function buildBundleLabelName(key: string, title?: string): string {
    const normalizedTitle = title?.trim();
    if (!normalizedTitle) {
        throw new Error('Bundle names cannot be empty.');
    }

    const name = `${BUNDLE_LABEL_PREFIX}${key}${BUNDLE_TITLE_SEPARATOR}${encodeURIComponent(normalizedTitle)}`;
    if (name.length > MAX_BUNDLE_LABEL_LENGTH) {
        throw new Error('Bundle name is too long.');
    }

    return name;
}

function parseBundleLabel(id: string, name: string): BundleLabel | undefined {
    const value = name.slice(BUNDLE_LABEL_PREFIX.length);
    const separatorIndex = value.indexOf(BUNDLE_TITLE_SEPARATOR);
    const key = separatorIndex === -1 ? value : value.slice(0, separatorIndex);
    if (!key) {
        return undefined;
    }

    if (separatorIndex === -1) {
        return {id, name, key};
    }

    try {
        const title = decodeURIComponent(value.slice(separatorIndex + BUNDLE_TITLE_SEPARATOR.length)).trim();
        return {id, name, key, title: title || undefined};
    } catch {
        return {id, name, key};
    }
}

export async function modifyMessageLabels(
    messageId: string,
    addLabelIds: string[] = [],
    removeLabelIds: string[] = [],
) {
    try {
        await gapi.client.gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            resource: {addLabelIds, removeLabelIds},
        });
    } catch (error) {
        throw new GmailApiError(error);
    }
}

export async function moveMessageToTrash(messageId: string) {
    try {
        await gapi.client.gmail.users.messages.trash({
            userId: 'me',
            id: messageId,
        });
    } catch (error) {
        throw new GmailApiError(error);
    }
}

export async function restoreMessageFromTrash(messageId: string) {
    try {
        await gapi.client.gmail.users.messages.untrash({
            userId: 'me',
            id: messageId,
        });
    } catch (error) {
        throw new GmailApiError(error);
    }
}

export async function deleteMessageForever(messageId: string) {
    try {
        await gapi.client.gmail.users.messages.delete({
            userId: 'me',
            id: messageId,
        });
    } catch (error) {
        throw new GmailApiError(error);
    }
}

export async function downloadAttachment(message: ParsedMessage, attachment: ParsedAttachment) {
    if (!message.id || !attachment.id) {
        return;
    }

    try {
        const response = await gapi.client.gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: message.id,
            id: attachment.id,
        });

        if (!response.result.data) {
            return;
        }

        const blob = new Blob([decodeBase64UrlToBytes(response.result.data)], {
            type: attachment.mimeType ?? 'application/octet-stream',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = attachment.filename;
        link.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        throw new GmailApiError(error);
    }
}

export function formatError(error: unknown): string {
    if (error instanceof GmailApiError) {
        return error.isAuthError
            ? 'Authorization failed. Please sign in again or grant Gmail access.'
            : error.message;
    }

    return getErrorMessage(error);
}

function collectMessageParts(
    part: gapi.client.gmail.MessagePart | undefined,
    htmlBodies: string[],
    textBodies: string[],
    attachments: ParsedAttachment[],
) {
    if (!part) {
        return;
    }

    if (part.filename && part.body?.attachmentId) {
        attachments.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size,
        });
    }

    if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBodies.push(decodeBase64Url(part.body.data));
    }

    if (part.mimeType === 'text/plain' && part.body?.data) {
        textBodies.push(decodeBase64Url(part.body.data));
    }

    for (const childPart of part.parts ?? []) {
        collectMessageParts(childPart, htmlBodies, textBodies, attachments);
    }
}

function getHeader(message: gapi.client.gmail.Message, name: string): string | undefined {
    return message.payload?.headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value;
}

function decodeBase64Url(value: string): string {
    return new TextDecoder().decode(decodeBase64UrlToBytes(value));
}

function decodeBase64UrlToBytes(value: string): Uint8Array {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(base64 + padding);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeHtmlEntities(value: string): string {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = value;
    return textArea.value;
}

function getErrorStatus(error: unknown): number | undefined {
    if (!isObject(error)) {
        return undefined;
    }

    const result = error.result;
    if (isObject(result) && typeof result.error === 'object' && result.error !== null) {
        const resultError = result.error as { code?: unknown };
        return typeof resultError.code === 'number' ? resultError.code : undefined;
    }

    return typeof error.status === 'number' ? error.status : undefined;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (isObject(error)) {
        const result = error.result;
        if (isObject(result) && typeof result.error === 'object' && result.error !== null) {
            const resultError = result.error as { message?: unknown };
            if (typeof resultError.message === 'string') {
                return resultError.message;
            }
        }

        if (typeof error.message === 'string') {
            return error.message;
        }
    }

    return 'Unexpected Gmail API error.';
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
