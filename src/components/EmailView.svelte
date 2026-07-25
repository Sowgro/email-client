<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import {PanelService} from "../services/PanelService.svelte";
    import {
        downloadAttachment,
        formatError,
        type ParsedAttachment,
        type ParsedMessage
    } from "../services/GmailService";

    let { message }: { message: ParsedMessage } = $props();
    let ps: PanelService = getContext(Context.PANEL_SERVICE)
    let attachmentError: unknown = $state();
    let downloadingAttachmentId: string | undefined = $state();

    function closePanel() {
        ps.panels.pop();
    }

    const handleAttachmentDownload = async (attachment: ParsedAttachment) => {
        attachmentError = undefined;
        downloadingAttachmentId = attachment.id;

        try {
            await downloadAttachment(message, attachment);
        } catch (ex) {
            attachmentError = ex;
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
                <span class="icon">more_vert</span>
                <span class="icon">star</span>
                <span class="icon">delete</span>
                <span class="icon">check</span>
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
            {#if attachmentError}
                <code>{formatError(attachmentError)}</code>
            {/if}
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
