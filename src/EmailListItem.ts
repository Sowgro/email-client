import type {ActionableMessage, ParsedMessage} from "./services/GmailService";

interface MessageListItem {
    kind: 'message';
    key: string;
    representative: ParsedMessage;
    actionMessages: ActionableMessage[];
}

interface BundleListItem {
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
    const items: EmailListItem[] = [];

    for (const message of messages) {
        if (!parseBundles || !message.bundleLabelId) {
            items.push({
                kind: 'message',
                key: `message:${message.id}`,
                representative: message,
                actionMessages: [message],
            });
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
