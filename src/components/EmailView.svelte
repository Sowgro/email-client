<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import {PanelService} from "../services/PanelService.svelte";
    import {ToastService} from "../services/ToastService.svelte";
    import ContextMenu from "./ContextMenu.svelte";
    import {
        downloadAttachment,
        formatError,
        type ParsedAttachment,
        type ParsedMessage
    } from "../services/GmailService";
    import {getRelevantActions, type MessageAction} from "../MessageActions";

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

    let downloadingAttachmentId: string | undefined = $state();
    let actions: MessageAction[] = $derived(getRelevantActions(message));

    function closePanel() {
        ps.panels = ps.panels.slice(0, -1);
    }

    const runAction = async (action: MessageAction) =>
        action.onAction(message.id!).then(() => {
            const selectedReplacement =
                onMessageChanged?.(message.id!, action.changes ?? {}, action.removeFromList) ?? false;

            if (action.removeFromList && !selectedReplacement) {
                closePanel();
            }

            toastService.success({
                message: `Success: ${action.label}`,
                action: {
                    label: "Undo",
                    fn: () => {/* TODO */}
                }
            })
        }).catch(ex => {
            toastService.error({
                message: `An error occurred while completing action ${action.label}`,
                error: formatError(ex)
            })
        })

    const handleAttachmentDownload = async (attachment: ParsedAttachment) => {
        downloadingAttachmentId = attachment.id;

        try {
            await downloadAttachment(message, attachment);
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
                        onclick={() => runAction(action)}
                    >
                        <span class="icon">{action.icon}</span>
                    </button>
                {/each}
                <ContextMenu>
                    {#each actions.slice(3) as action (action.label)}
                        <button
                                role="menuitem"
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
        <span class="sender">From: {message.sender}</span>

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
