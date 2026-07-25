<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import {PanelService} from "../services/PanelService.svelte";
    import {ToastService} from "../services/ToastService.svelte";
    import ContextMenu from "./ContextMenu.svelte";
    import {
        downloadAttachment,
        formatError,
        modifyMessageLabels,
        moveMessageToTrash,
        type ParsedAttachment,
        type ParsedMessage
    } from "../services/GmailService";

    let {
        message,
        onMessageChanged,
    }: {
        message: ParsedMessage,
        onMessageChanged?: (
            messageId: string,
            changes: Partial<ParsedMessage>,
            removeFromList?: boolean,
        ) => void,
    } = $props();

    let ps: PanelService = getContext(Context.PANEL_SERVICE)
    let toastService: ToastService = getContext(Context.TOAST_SERVICE)

    let downloadingAttachmentId: string | undefined = $state();
    let activeAction: string | undefined = $state();
    let starred = $state(message.starred);
    let unread = $state(message.unread);

    $effect(() => {
        starred = message.starred;
        unread = message.unread;
    })

    function closePanel() {
        ps.panels = ps.panels.slice(0, -1);
    }

    const runAction = async (
        name: string,
        action: (messageId: string) => Promise<void>,
        changes: Partial<ParsedMessage>,
        removeFromList = false,
    ): Promise<boolean> => {
        if (!message.id) {
            return false;
        }

        activeAction = name;

        try {
            await action(message.id);
            onMessageChanged?.(message.id, changes, removeFromList);
            toastService.success(`${name.charAt(0).toUpperCase()}${name.slice(1)} completed.`);

            if (removeFromList) {
                closePanel();
            }
            return true;
        } catch (ex) {
            toastService.error(formatError(ex));
            return false;
        } finally {
            activeAction = undefined;
        }
    }

    const toggleStar = async () => {
        const nextStarred = !starred;
        const succeeded = await runAction(
            nextStarred ? 'star' : 'unstar',
            (id) => modifyMessageLabels(
                id,
                nextStarred ? ['STARRED'] : [],
                nextStarred ? [] : ['STARRED'],
            ),
            {starred: nextStarred},
        );

        if (succeeded) {
            starred = nextStarred;
        }
    }

    const archive = () => runAction(
        'archive',
        (id) => modifyMessageLabels(id, [], ['INBOX']),
        {},
        true,
    )

    const trash = () => runAction('trash', moveMessageToTrash, {}, true)

    const markUnread = async () => {
        const succeeded = await runAction(
            'unread',
            (id) => modifyMessageLabels(id, ['UNREAD']),
            {unread: true},
        );
        if (succeeded) {
            unread = true;
        }
    }

    const markSpam = () => runAction(
        'spam',
        (id) => modifyMessageLabels(id, ['SPAM'], ['INBOX']),
        {},
        true,
    )

    const handleAttachmentDownload = async (attachment: ParsedAttachment) => {
        downloadingAttachmentId = attachment.id;

        try {
            await downloadAttachment(message, attachment);
        } catch (ex) {
            toastService.error(formatError(ex));
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

<div class="panel anim-test">
    <div class="emailView">
        <div class="action-bar">
            <div class="left">
                <button
                    class="icon-button"
                    tabindex="0"
                    onclick={closePanel}
                >
                    <span class="icon">keyboard_arrow_right</span>
                </button>
            </div>
            <div class="right">
                <ContextMenu disabled={Boolean(activeAction)}>
                    <button role="menuitem" disabled={unread || Boolean(activeAction)} onclick={markUnread}>
                        <span class="icon">mark_email_unread</span>
                        Mark as unread
                    </button>
                    <button role="menuitem" disabled={Boolean(activeAction)} onclick={markSpam}>
                        <span class="icon">report</span>
                        Mark as spam
                    </button>
                </ContextMenu>
                <button
                    class:active={starred}
                    class="icon-button"
                    aria-label={starred ? 'Unpin message' : 'Pin message'}
                    title={starred ? 'Unpin message' : 'Pin message'}
                    disabled={!message.id || Boolean(activeAction)}
                    onclick={toggleStar}
                >
                    <span class="icon">push_pin</span>
                </button>
                <button
                    class="icon-button"
                    aria-label="Move to trash"
                    title="Move to trash"
                    disabled={!message.id || Boolean(activeAction)}
                    onclick={trash}
                >
                    <span class="icon">delete</span>
                </button>
                <button
                    class="icon-button"
                    aria-label="Done (archive)"
                    title="Done (archive)"
                    disabled={!message.id || Boolean(activeAction)}
                    onclick={archive}
                >
                    <span class="icon">check</span>
                </button>
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
    }

    .icon-button.active {
        color: #e083ff;
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
