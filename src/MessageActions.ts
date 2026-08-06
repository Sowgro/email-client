import {
    batchModifyMessageLabels,
    deleteMessageForever,
    modifyMessageLabels,
    moveMessageToTrash,
    type ActionableMessage,
    type ParsedMessage,
    restoreMessageFromTrash
} from "./services/GmailService";

interface MessageAction {
    label: string;
    icon: string;
    onAction: (messageId: string) => Promise<void>;
    onBulkAction?: (messageIds: string[]) => Promise<void>;
    confirm?: (count: number) => boolean;
    changes?: Partial<ParsedMessage>;
    removeFromList?: boolean;
    isActive?: boolean;
}

const INDIVIDUAL_ACTION_CONCURRENCY = 25;

async function executeIndividually(
    messageIds: string[],
    action: (messageId: string) => Promise<void>,
) {
    for (let index = 0; index < messageIds.length; index += INDIVIDUAL_ACTION_CONCURRENCY) {
        await Promise.all(messageIds.slice(index, index + INDIVIDUAL_ACTION_CONCURRENCY).map(action));
    }
}

const star: MessageAction = {
    label: 'Pin message',
    icon: "push_pin",
    onAction: (id) => modifyMessageLabels(id, ['STARRED']),
    onBulkAction: (ids) => batchModifyMessageLabels(ids, ['STARRED']),
    changes: {starred: true},
    isActive: false
}

const unstar: MessageAction = {
    label: 'Unpin message',
    icon: "push_pin",
    onAction: (id) => modifyMessageLabels(id, [], ['STARRED']),
    onBulkAction: (ids) => batchModifyMessageLabels(ids, [], ['STARRED']),
    changes: {starred: false},
    isActive: true
}

const archive: MessageAction = {
    label: "Done",
    icon: "check",
    onAction: (id) => modifyMessageLabels(id, [], ['INBOX']),
    onBulkAction: (ids) => batchModifyMessageLabels(ids, [], ['INBOX']),
    removeFromList: true,
}

const trash: MessageAction = {
    label: "Move to trash",
    icon: "delete",
    onAction: moveMessageToTrash,
    onBulkAction: (ids) => executeIndividually(ids, moveMessageToTrash),
    removeFromList: true,
}

const restore: MessageAction = {
    label: "Restore from trash",
    icon: "restore_from_trash",
    onAction: restoreMessageFromTrash,
    onBulkAction: (ids) => executeIndividually(ids, restoreMessageFromTrash),
    removeFromList: true,
}

const permanentlyDelete: MessageAction = {
    label: "Delete forever",
    icon: "delete_forever",
    onAction: deleteMessageForever,
    onBulkAction: (ids) => executeIndividually(ids, deleteMessageForever),
    confirm: (count) => window.confirm(
        `Permanently delete ${count === 1 ? 'this message' : `${count} messages`}? This cannot be undone.`
    ),
    removeFromList: true,
}

const moveToInbox: MessageAction = {
    label: "Move to inbox",
    icon: "move_to_inbox",
    onAction: (id) => modifyMessageLabels(id, ['INBOX']),
    onBulkAction: (ids) => batchModifyMessageLabels(ids, ['INBOX']),
    removeFromList: true,
}

const markUnread: MessageAction = {
    label: "Mark as unread",
    icon: "mark_email_unread",
    onAction: (id) => modifyMessageLabels(id, ['UNREAD']),
    onBulkAction: (ids) => batchModifyMessageLabels(ids, ['UNREAD']),
    changes: {unread: true},
}

const markSpam: MessageAction = {
    label: "Mark as spam",
    icon: "report",
    onAction: (id) => modifyMessageLabels(id, ['SPAM'], ['INBOX']),
    onBulkAction: (ids) => batchModifyMessageLabels(ids, ['SPAM'], ['INBOX']),
    removeFromList: true,
}

const markRead: MessageAction = {
    label: "Mark as read",
    icon: "mark_email_read",
    onAction: (id) => modifyMessageLabels(id, [], ['UNREAD']),
    onBulkAction: (ids) => batchModifyMessageLabels(ids, [], ['UNREAD']),
    changes: {unread: false},
}

function getRelevantActions(message: ActionableMessage): MessageAction[] {
    const actions: MessageAction[] = [];
    const isInTrash = message.labelIds.includes('TRASH');
    const isInInbox = message.labelIds.includes('INBOX');
    const isSpam = message.labelIds.includes('SPAM');

    if (isInTrash) {
        actions.push(restore, permanentlyDelete);
    } else {
        actions.push(isInInbox ? archive : moveToInbox, trash);
    }

    actions.push(message.starred ? unstar : star);

    actions.push(message.unread ? markRead : markUnread);

    if (!isSpam) {
        actions.push(markSpam);
    }

    return actions;
}

function getCommonActions(messages: ActionableMessage[]): MessageAction[] {
    if (!messages.length) {
        return [];
    }

    const remainingActionLabels = messages.slice(1).map((message) =>
        new Set(getRelevantActions(message).map((action) => action.label))
    );
    return getRelevantActions(messages[0]).filter((action) =>
        remainingActionLabels.every((labels) => labels.has(action.label))
    );
}

async function executeMessageAction(action: MessageAction, messageIds: string[]): Promise<boolean> {
    const uniqueIds = [...new Set(messageIds)];
    if (!uniqueIds.length || (action.confirm && !action.confirm(uniqueIds.length))) {
        return false;
    }

    if (action.onBulkAction) {
        await action.onBulkAction(uniqueIds);
    } else {
        await Promise.all(uniqueIds.map(action.onAction));
    }
    return true;
}

let messageActions = { permanentlyDelete }

export {
    type MessageAction,
    executeMessageAction,
    getCommonActions,
    getRelevantActions,
    messageActions,
};
