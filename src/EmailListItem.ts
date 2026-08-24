import type {ActionableMessage, ParsedMessage} from "./services/GmailService";

interface MessageListItem {
    kind: 'message';
    key: string;
    representative: ParsedMessage;
    actionMessages: ParsedMessage[];
}

export interface BundleListItem {
    kind: 'bundle';
    key: string;
    representative: ParsedMessage;
    actionMessages: ActionableMessage[];
    bundleLabelId: string;
    bundleTitle?: string;
}

export type EmailListItem = MessageListItem | BundleListItem;

export function buildListItems(
    messages: ParsedMessage[],
    parseBundles = true,
): EmailListItem[] {
    const seenBundleIds = new Set<string>();
    const threadItems = new Map<string, MessageListItem>();
    const items: EmailListItem[] = [];

    for (const message of messages) {
        if (!parseBundles || !message.bundleLabelId) {
            const key = message.threadId
                ? `thread:${message.threadId}`
                : `message:${message.id ?? items.length}`;
            const existingThread = threadItems.get(key);

            if (existingThread) {
                existingThread.actionMessages.push(message);
                continue;
            }

            const threadItem: MessageListItem = {
                kind: 'message',
                key,
                representative: message,
                actionMessages: [message],
            };
            threadItems.set(key, threadItem);
            items.push(threadItem);
            continue;
        }

        if (seenBundleIds.has(message.bundleLabelId)) {
            continue;
        }
        seenBundleIds.add(message.bundleLabelId);

        items.push({
            kind: 'bundle',
            key: `bundle:${message.bundleLabelId}`,
            representative: message,
            actionMessages: message.bundleSummary?.messages ?? [message],
            bundleLabelId: message.bundleLabelId,
            bundleTitle: message.bundleTitle,
        });
    }

    return items;
}
