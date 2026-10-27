import type {ActionableMessage} from "./services/GmailService";
import type {MessageMutation} from "./MessageMutation";

interface MessageAction {
    label: string;
    icon: string;
    mutation: MessageMutation;
    confirm?: (count: number) => boolean;
    isActive?: boolean;
}

const star: MessageAction = {
    label: 'Pin message',
    icon: "push_pin",
    mutation: {kind: 'labels', addLabelIds: ['STARRED']},
    isActive: false
}

const unstar: MessageAction = {
    label: 'Unpin message',
    icon: "push_pin",
    mutation: {kind: 'labels', removeLabelIds: ['STARRED']},
    isActive: true
}

const archive: MessageAction = {
    label: "Done",
    icon: "check",
    mutation: {kind: 'labels', removeLabelIds: ['INBOX']},
}

const trash: MessageAction = {
    label: "Move to trash",
    icon: "delete",
    mutation: {kind: 'trash'},
}

const restore: MessageAction = {
    label: "Restore from trash",
    icon: "restore_from_trash",
    mutation: {kind: 'restore'},
}

const permanentlyDelete: MessageAction = {
    label: "Delete forever",
    icon: "delete_forever",
    mutation: {kind: 'delete'},
    confirm: (count) => window.confirm(
        `Permanently delete ${count === 1 ? 'this message' : `${count} messages`}? This cannot be undone.`
    ),
}

const moveToInbox: MessageAction = {
    label: "Move to inbox",
    icon: "move_to_inbox",
    mutation: {kind: 'labels', addLabelIds: ['INBOX']},
}

const markUnread: MessageAction = {
    label: "Mark as unread",
    icon: "mark_email_unread",
    mutation: {kind: 'labels', addLabelIds: ['UNREAD']},
}

const markSpam: MessageAction = {
    label: "Mark as spam",
    icon: "report",
    mutation: {kind: 'labels', addLabelIds: ['SPAM'], removeLabelIds: ['INBOX']},
}

const markRead: MessageAction = {
    label: "Mark as read",
    icon: "mark_email_read",
    mutation: {kind: 'labels', removeLabelIds: ['UNREAD']},
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
    const actionsByLabel = new Map<string, MessageAction>();
    for (const message of messages) {
        for (const action of getRelevantActions(message)) {
            actionsByLabel.set(action.label, action);
        }
    }
    return [...actionsByLabel.values()];
}

export {
    type MessageAction,
    getCommonActions,
    getRelevantActions,
};
