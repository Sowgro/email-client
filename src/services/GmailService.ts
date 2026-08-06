import {
    loadBundleSummaries,
    listBundleLabels,
    type BundleLabel,
    type BundleSummary,
} from "./BundleService";
import {GmailApiError} from "./GmailApiError";

export {formatError, GmailApiError} from "./GmailApiError";
export type {BundleLabel, BundleSummary} from "./BundleService";

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

export interface ActionableMessage {
    id?: string;
    labelIds: string[];
    starred: boolean;
    unread: boolean;
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

const metadataHeaders = ['From', 'Subject', 'Date'];
const GMAIL_BATCH_MODIFY_LIMIT = 1000;

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

export async function batchModifyMessageLabels(
    messageIds: string[],
    addLabelIds: string[] = [],
    removeLabelIds: string[] = [],
) {
    if (!messageIds.length) {
        return;
    }

    try {
        const requests: Promise<unknown>[] = [];
        for (let index = 0; index < messageIds.length; index += GMAIL_BATCH_MODIFY_LIMIT) {
            requests.push(gapi.client.gmail.users.messages.batchModify({
                userId: 'me',
                resource: {
                    ids: messageIds.slice(index, index + GMAIL_BATCH_MODIFY_LIMIT),
                    addLabelIds,
                    removeLabelIds,
                },
            }));
        }
        await Promise.all(requests);
    } catch (error) {
        throw new GmailApiError(error);
    }
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
