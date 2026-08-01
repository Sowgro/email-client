import {
    deleteMessageForever,
    modifyMessageLabels,
    moveMessageToTrash,
    type ParsedMessage,
    restoreMessageFromTrash
} from "./services/GmailService";

interface MessageAction {
    label: string;
    icon: string;
    onAction: (messageId: string) => Promise<void>;
    changes?: Partial<ParsedMessage>;
    removeFromList?: boolean;
    isActive?: boolean;
}

const star: MessageAction = {
    label: 'Pin message',
    icon: "push_pin",
    onAction: (id) => modifyMessageLabels(id, ['STARRED']),
    changes: {starred: true},
    isActive: false
}

const unstar: MessageAction = {
    label: 'Unpin message',
    icon: "push_pin",
    onAction: (id) => modifyMessageLabels(id, [], ['STARRED']),
    changes: {starred: false},
    isActive: true
}

const archive: MessageAction = {
    label: "Done",
    icon: "check",
    onAction: (id) => modifyMessageLabels(id, [], ['INBOX']),
    removeFromList: true,
}

const trash: MessageAction = {
    label: "Move to trash",
    icon: "delete",
    onAction: moveMessageToTrash,
    removeFromList: true,
}

const restore: MessageAction = {
    label: "Restore from trash",
    icon: "restore_from_trash",
    onAction: restoreMessageFromTrash,
    removeFromList: true,
}

const permanentlyDelete: MessageAction = {
    label: "Delete forever",
    icon: "delete_forever",
    onAction: async (id) => {
        if (!window.confirm('Permanently delete this message? This cannot be undone.')) {
            return
        }
        await deleteMessageForever(id)
    },
    removeFromList: true,
}

const moveToInbox: MessageAction = {
    label: "Move to inbox",
    icon: "move_to_inbox",
    onAction: (id) => modifyMessageLabels(id, ['INBOX']),
    removeFromList: true,
}

const markUnread: MessageAction = {
    label: "Mark as unread",
    icon: "mark_email_unread",
    onAction: (id) => modifyMessageLabels(id, ['UNREAD']),
    changes: {unread: true},
}

const markSpam: MessageAction = {
    label: "Mark as spam",
    icon: "report",
    onAction: (id) => modifyMessageLabels(id, ['SPAM'], ['INBOX']),
    removeFromList: true,
}

const markRead: MessageAction = {
    label: "Mark as read",
    icon: "mark_email_read",
    onAction: (id) => modifyMessageLabels(id, [], ['UNREAD']),
    changes: {unread: false},
}

function getRelevantActions(message: ParsedMessage): MessageAction[] {
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

let messageActions = { permanentlyDelete }

export {type MessageAction, getRelevantActions, messageActions};
