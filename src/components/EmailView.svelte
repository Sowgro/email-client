<script lang="ts">
    import {getContext, onMount} from "svelte";
    import {Context} from "../Context";
    import {PanelService} from "../services/PanelService.svelte";
    import {ToastService} from "../services/ToastService.svelte";
    import ContextMenu from "./ContextMenu.svelte";
    import {
        downloadAttachment,
        formatError,
        modifyMessageLabels,
        type ParsedAttachment,
        type ParsedMessage
    } from "../services/GmailService";
    import {getRelevantActions, type MessageAction} from "../MessageActions";
    import type {GmailOperationService} from "../services/GmailOperationService.svelte";
    import {formatEmailViewDate} from "../DateFormatter";

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

    let ps: PanelService = getContext(Context.PANEL_SERVICE)
    let toastService: ToastService = getContext(Context.TOAST_SERVICE)
    let gmailOperations: GmailOperationService = getContext(Context.GMAIL_OPERATION_SERVICE)

    let downloadingAttachmentId: string | undefined = $state();
    let currentTime = $state(new Date());
    let actions: MessageAction[] = $derived(getRelevantActions(message));
    let formattedDate = $derived(formatEmailViewDate(message.date, currentTime));

    const MARK_AS_READ_DELAY_MS = 3_000;

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

    function closePanel() {
        ps.panels = ps.panels.slice(0, -1);
    }

    const runAction = async (action: MessageAction) => {
        if (!message.id) {
            return;
        }

        const executed = await gmailOperations.runMessageAction(action, message.id);
        if (!executed) {
            return;
        }

        const selectedReplacement =
            onMessageChanged?.(message.id, action.changes ?? {}, action.removeFromList) ?? false;

        if (action.removeFromList && !selectedReplacement) {
            closePanel();
        }

        toastService.success({
            message: `Success: ${action.label}`,
            action: {
                label: "Undo",
                fn: () => {/* TODO */}
            }
        });
    };

    const handleAttachmentDownload = async (attachment: ParsedAttachment) => {
        downloadingAttachmentId = attachment.id;

        try {
            await gmailOperations.run(() => downloadAttachment(message, attachment));
        } catch (ex) {
            toastService.error({
                message: "An error occurred while downloading the attachment",
                error: formatError(ex)
            })
        } finally {
            downloadingAttachmentId = undefined;
        }
    }

    const formatAttachmentSize = (size?: number) => {
        if (!size) {
            return '';
        }

        if (size < 1024 * 1024) {
            return `${Math.ceil(size / 1024)} KB`;
        }

        return `${(size / 1024 / 1024).toFixed(1)} MB`;
    }

</script>

<div class="panel">
    <div class="emailView">
        <div class="action-bar">
            <div class="action-group left">
                <button
                    class="icon-button"
                    tabindex="0"
                    onclick={closePanel}
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
        <span class="subject">{message.subject}</span>
        <span class="sender">{message.sender}, {formattedDate}</span>

        {#if message.attachments.length}
            <div class="attachments">
                {#each message.attachments as attachment}
                    <button
                        class="attachment"
                        disabled={!attachment.id || downloadingAttachmentId === attachment.id}
                        onclick={() => handleAttachmentDownload(attachment)}
                    >
                        <span class="icon">attach_file</span>
                        <span>{attachment.filename}</span>
                        <span class="attachment-size">{formatAttachmentSize(attachment.size)}</span>
                    </button>
                {/each}
            </div>
        {/if}

        {#if message.html}
            <iframe title="email" class="content" sandbox="" srcdoc={message.html}></iframe>
        {:else if message.text}
            <div class="content plain-text">{message.text}</div>
        {:else}
            <span>No message body found.</span>
        {/if}
    </div>
</div>

<style>
    .emailView {
        display: flex;
        flex-direction: column;
        gap: 5px;
        height: 100%;
    }

    .content {
        display: block;
        overflow: clip;
    }

    .action-bar {
        display: flex;
    }

    .action-bar .right {
        align-items: center;
        flex-direction: row-reverse;
    }

    .subject {
        font-size: larger;
    }

    .content {
        padding-top: 20px;
    }

    .plain-text {
        white-space: pre-wrap;
    }

    .attachments {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
    }

    .attachment {
        margin-bottom: 3px;
    }

    .attachment-size {
        opacity: 0.7;
    }
</style>
