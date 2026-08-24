<script lang="ts">
    import {getContext, onMount} from "svelte";
    import {Context} from "../Context";
    import {getRelevantActions, type MessageAction} from "../MessageActions";
    import {
        formatError,
        getThreadMessages,
        modifyMessageLabels,
        type ParsedMessage,
    } from "../services/GmailService";
    import type {GmailOperationService} from "../services/GmailOperationService.svelte";
    import {PanelService} from "../services/PanelService.svelte";
    import {ToastService} from "../services/ToastService.svelte";
    import ContextMenu from "./ContextMenu.svelte";
    import ConversationMessage from "./ConversationMessage.svelte";
    import {formatConversationSubject} from "../SubjectFormatter";

    let {
        message,
        onMessageChanged,
    }: {
        message: ParsedMessage,
        onMessageChanged?: (
            messageId: string,
            changes: Partial<ParsedMessage>,
            removeFromList?: boolean,
        ) => boolean,
    } = $props();

    const ps: PanelService = getContext(Context.PANEL_SERVICE);
    const toastService: ToastService = getContext(Context.TOAST_SERVICE);
    const gmailOperations: GmailOperationService = getContext(Context.GMAIL_OPERATION_SERVICE);

    let currentTime = $state(new Date());
    let threadMessages: ParsedMessage[] = $state([message]);
    let loadingThread = $state(Boolean(message.threadId));
    let expandedMessageKeys: string[] = $state([getMessageKey(message, 0)]);
    let actions: MessageAction[] = $derived(getRelevantActions(message));
    let conversationSubject = $derived(formatConversationSubject(threadMessages, message.subject));

    const MARK_AS_READ_DELAY_MS = 3_000;

    onMount(() => {
        let cancelled = false;

        const loadThread = async () => {
            if (!message.threadId) {
                loadingThread = false;
                return;
            }

            try {
                const loadedMessages = await gmailOperations.run(() => getThreadMessages(message));
                if (cancelled) {
                    return;
                }

                threadMessages = sortThreadMessages(loadedMessages);
                const selectedIndex = threadMessages.findIndex(({id}) => id === message.id);
                const expandedIndex = selectedIndex >= 0 ? selectedIndex : threadMessages.length - 1;
                expandedMessageKeys = [getMessageKey(threadMessages[expandedIndex], expandedIndex)];
            } catch (ex) {
                if (!cancelled) {
                    toastService.error({
                        message: "Failed to load conversation",
                        error: formatError(ex),
                    });
                }
            } finally {
                if (!cancelled) {
                    loadingThread = false;
                }
            }
        };

        void loadThread();
        return () => {
            cancelled = true;
        };
    });

    onMount(() => {
        const messageId = message.id;
        if (!messageId || !message.unread) {
            return;
        }

        const timeoutId = window.setTimeout(async () => {
            if (message.id !== messageId || !message.unread) {
                return;
            }

            try {
                await gmailOperations.run(() => modifyMessageLabels(messageId, [], ['UNREAD']));
                threadMessages = threadMessages.map((threadMessage) =>
                    threadMessage.id === messageId
                        ? {
                            ...threadMessage,
                            unread: false,
                            labelIds: threadMessage.labelIds.filter((labelId) => labelId !== 'UNREAD'),
                        }
                        : threadMessage
                );
                onMessageChanged?.(messageId, {
                    unread: false,
                    labelIds: message.labelIds.filter((labelId) => labelId !== 'UNREAD'),
                });
            } catch (ex) {
                toastService.error({
                    message: "Failed to mark message as read",
                    error: formatError(ex),
                });
            }
        }, MARK_AS_READ_DELAY_MS);

        return () => window.clearTimeout(timeoutId);
    });

    onMount(() => {
        const intervalId = window.setInterval(() => {
            currentTime = new Date();
        }, 60_000);

        return () => window.clearInterval(intervalId);
    });

    const runAction = async (action: MessageAction) => {
        if (!message.id) {
            return;
        }

        const executed = await gmailOperations.runMessageAction(action, message.id);
        if (!executed) {
            return;
        }

        if (action.changes) {
            threadMessages = threadMessages.map((threadMessage) =>
                threadMessage.id === message.id ? {...threadMessage, ...action.changes} : threadMessage
            );
        }

        const selectedReplacement =
            onMessageChanged?.(message.id, action.changes ?? {}, action.removeFromList) ?? false;

        if (action.removeFromList && !selectedReplacement) {
            ps.closeLast();
        }

        toastService.success({
            message: `Success: ${action.label}`,
            action: {
                label: "Undo",
                fn: () => {/* TODO */},
            },
        });
    };

    const toggleMessage = (threadMessage: ParsedMessage, index: number) => {
        const key = getMessageKey(threadMessage, index);
        expandedMessageKeys = expandedMessageKeys.includes(key)
            ? expandedMessageKeys.filter((expandedKey) => expandedKey !== key)
            : [...expandedMessageKeys, key];
    };

    function getMessageKey(threadMessage: ParsedMessage, index: number): string {
        return threadMessage.id ?? `${threadMessage.date ?? 'message'}:${index}`;
    }

    function sortThreadMessages(messages: ParsedMessage[]): ParsedMessage[] {
        return [...messages].sort((left, right) => getTimestamp(left) - getTimestamp(right));
    }

    function getTimestamp(threadMessage: ParsedMessage): number {
        const internalTimestamp = Number(threadMessage.internalDate);
        if (Number.isFinite(internalTimestamp) && internalTimestamp > 0) {
            return internalTimestamp;
        }

        const headerTimestamp = Date.parse(threadMessage.date ?? '');
        return Number.isNaN(headerTimestamp) ? 0 : headerTimestamp;
    }

</script>

<div class="panel">
    <div class="email-view">
        <div class="action-bar">
            <div class="action-group left">
                <button
                    class="icon-button"
                    tabindex="0"
                    onclick={() => ps.closeLast()}
                    title="Close panel"
                >
                    <span class="icon">keyboard_arrow_right</span>
                </button>
            </div>
            <div class="action-group right">
                {#each actions.slice(0, 3) as action (action.label)}
                    <button
                        class:active={action.isActive}
                        class="icon-button"
                        aria-label={action.label}
                        title={action.label}
                        disabled={!message.id || gmailOperations.messageActionBusy}
                        onclick={() => runAction(action)}
                    >
                        <span class="icon">{action.icon}</span>
                    </button>
                {/each}
                <ContextMenu disabled={gmailOperations.messageActionBusy}>
                    {#each actions.slice(3) as action (action.label)}
                        <button
                            role="menuitem"
                            disabled={!message.id || gmailOperations.messageActionBusy}
                            onclick={() => runAction(action)}
                        >
                            <span class="icon">{action.icon}</span>
                            {action.label}
                        </button>
                    {/each}
                </ContextMenu>
            </div>
        </div>

        <span class="list-title">
            {conversationSubject}
            {#if threadMessages.length > 1}
                <span class="count">({threadMessages.length})</span>
            {/if}
        </span>

        <div class="conversation" aria-label="Conversation">
            {#each threadMessages as threadMessage, index (getMessageKey(threadMessage, index))}
                {@const messageKey = getMessageKey(threadMessage, index)}
                <ConversationMessage
                    message={threadMessage}
                    {currentTime}
                    expanded={expandedMessageKeys.includes(messageKey)}
                    onToggle={() => toggleMessage(threadMessage, index)}
                />
            {/each}
        </div>
    </div>

    {#if loadingThread}
        <div class="thread-loading" role="status">
            Loading conversation…
        </div>
    {/if}
</div>

<style>
    .email-view {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-height: 100%;
    }

    .action-bar .right {
        align-items: center;
        flex-direction: row-reverse;
    }

    .thread-loading {
        align-items: center;
        color: rgba(255, 255, 255, 0.62);
        display: flex;
        font-size: 0.85rem;
        gap: 6px;
    }

    .conversation {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-bottom: 10px;
    }

    .list-title {
        font-size: larger;
        align-items: center;
        display: flex;
        margin-bottom: 5px;
        gap: 5px;
    }
</style>
