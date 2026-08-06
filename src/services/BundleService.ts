import {GmailApiError} from "./GmailApiError";
import type {ActionableMessage, ParsedMessage} from "./GmailService";

export interface BundleSummary {
    count: number;
    hasMore: boolean;
    senders: string[];
    messages: ActionableMessage[];
}

export interface BundleLabel {
    id: string;
    name: string;
    key: string;
    title?: string;
}

interface BundleMessageMetadata extends ActionableMessage {
    sender?: string;
}

const BUNDLE_LABEL_PREFIX = 'Fettuccemail/Bundles/';
const BUNDLE_TITLE_SEPARATOR = '::';
const MAX_BUNDLE_LABEL_LENGTH = 225;
const BUNDLE_SUMMARY_LIMIT = 25;
const GMAIL_LIST_LIMIT = 500;

export async function loadBundleSummaries(
    messages: ParsedMessage[],
): Promise<Map<string, BundleSummary>> {
    try {
        const bundleLabelIds = new Set(
            messages.flatMap((message) => message.bundleLabelId ? [message.bundleLabelId] : [])
        );
        const knownMessages = new Map(
            messages.flatMap((message) => message.id ? [[message.id, message] as const] : [])
        );
        const summaries = await Promise.all(
            [...bundleLabelIds].map(async (bundleLabelId) => {
                const messageRefs = await listMessageRefsByLabel(bundleLabelId);
                const bundleMessages: BundleMessageMetadata[] = await Promise.all(
                    messageRefs.map(async ({id}) => {
                        const knownMessage = knownMessages.get(id!);
                        if (knownMessage) {
                            return knownMessage;
                        }

                        const response = await gapi.client.gmail.users.messages.get({
                            userId: 'me',
                            id: id!,
                            format: 'metadata',
                            metadataHeaders: ['From'],
                        });
                        const labelIds = response.result.labelIds ?? [];
                        return {
                            id: response.result.id,
                            sender: getHeader(response.result, 'From'),
                            labelIds,
                            starred: labelIds.includes('STARRED'),
                            unread: labelIds.includes('UNREAD'),
                        };
                    })
                );

                return [bundleLabelId, {
                    count: Math.min(messageRefs.length, BUNDLE_SUMMARY_LIMIT),
                    hasMore: messageRefs.length > BUNDLE_SUMMARY_LIMIT,
                    senders: bundleMessages
                        .slice(0, BUNDLE_SUMMARY_LIMIT)
                        .map((message) => message.sender ?? 'Unknown sender'),
                    messages: bundleMessages,
                }] as const;
            })
        );

        return new Map(summaries);
    } catch (error) {
        throw asGmailApiError(error);
    }
}

export async function listAllMessageIds(labelId: string): Promise<string[]> {
    try {
        return (await listMessageRefsByLabel(labelId)).map((message) => message.id!);
    } catch (error) {
        throw asGmailApiError(error);
    }
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
        try {
            await gapi.client.gmail.users.messages.modify({
                userId: 'me',
                id: source.id,
                resource: {addLabelIds: [target.bundleLabelId]},
            });
            return;
        } catch (error) {
            throw asGmailApiError(error);
        }
    }

    let createdLabelId: string | undefined;
    try {
        const response = await gapi.client.gmail.users.labels.create({
            userId: 'me',
            resource: {
                name: buildBundleLabelName(crypto.randomUUID(), title),
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
    } catch (error) {
        if (createdLabelId) {
            try {
                await gapi.client.gmail.users.labels.delete({userId: 'me', id: createdLabelId});
            } catch {
                // The unused label is harmless if Gmail rejects cleanup.
            }
        }
        throw asGmailApiError(error);
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
        throw asGmailApiError(error);
    }
}

export async function listBundleLabels(): Promise<Map<string, BundleLabel>> {
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
        throw asGmailApiError(error);
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

async function listMessageRefsByLabel(labelId: string): Promise<gapi.client.gmail.Message[]> {
    const messages: gapi.client.gmail.Message[] = [];
    let pageToken: string | undefined;

    do {
        const response = await gapi.client.gmail.users.messages.list({
            userId: 'me',
            maxResults: GMAIL_LIST_LIMIT,
            pageToken,
            labelIds: [labelId],
            includeSpamTrash: true,
        });
        messages.push(...(response.result.messages ?? []).filter((message) => message.id));
        pageToken = response.result.nextPageToken;
    } while (pageToken);

    return messages;
}

function getHeader(message: gapi.client.gmail.Message, name: string): string | undefined {
    return message.payload?.headers
        ?.find((header) => header.name?.toLowerCase() === name.toLowerCase())
        ?.value;
}

function asGmailApiError(error: unknown): GmailApiError {
    return error instanceof GmailApiError ? error : new GmailApiError(error);
}
