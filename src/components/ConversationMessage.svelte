<script lang="ts">
    import {getContext} from "svelte";
    import createDOMPurify from "dompurify";
    import {Context} from "../Context";
    import {formatEmailViewDate} from "../DateFormatter";
    import {formatSenderName} from "../SenderFormatter";
    import {
        downloadAttachment,
        formatError,
        type ParsedAttachment,
        type ParsedMessage,
    } from "../services/GmailService";
    import type {GmailOperationService} from "../services/GmailOperationService.svelte";
    import type {ToastService} from "../services/ToastService.svelte";
    import SenderAvatar from "./SenderAvatar.svelte";

    let {
        message,
        expanded,
        currentTime,
        onToggle,
    }: {
        message: ParsedMessage,
        expanded: boolean,
        currentTime: Date,
        onToggle: () => void,
    } = $props();

    const toastService: ToastService = getContext(Context.TOAST_SERVICE);
    const gmailOperations: GmailOperationService = getContext(Context.GMAIL_OPERATION_SERVICE);

    let downloadingAttachmentId: string | undefined = $state();
    let formattedDate = $derived(formatEmailViewDate(message.date, currentTime));
    let sanitizedHtml = $derived(message.html ? sanitizeEmailHtml(message.html) : '');

    const handleAttachmentDownload = async (attachment: ParsedAttachment) => {
        downloadingAttachmentId = attachment.id;

        try {
            await gmailOperations.run(() => downloadAttachment(message, attachment));
        } catch (ex) {
            toastService.error({
                message: "An error occurred while downloading the attachment",
                error: formatError(ex),
            });
        } finally {
            downloadingAttachmentId = undefined;
        }
    };

    const formatAttachmentSize = (size?: number) => {
        if (!size) {
            return '';
        }

        if (size < 1024 * 1024) {
            return `${Math.ceil(size / 1024)} KB`;
        }

        return `${(size / 1024 / 1024).toFixed(1)} MB`;
    };

    function sanitizeEmailHtml(html: string): string {
        const sanitizer = createDOMPurify(window);
        sanitizer.addHook('afterSanitizeAttributes', (node) => {
            if (node.nodeName === 'A' && node.hasAttribute('href')) {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer');
            }

            if (node.nodeName === 'IMG') {
                node.setAttribute('loading', 'lazy');
                node.setAttribute('referrerpolicy', 'no-referrer');
            }
        });

        return sanitizer.sanitize(html, {
            USE_PROFILES: {html: true},
            SANITIZE_NAMED_PROPS: true,
            ALLOW_DATA_ATTR: false,
            FORBID_TAGS: [
                'base',
                'button',
                'audio',
                'embed',
                'form',
                'iframe',
                'input',
                'link',
                'meta',
                'object',
                'option',
                'script',
                'select',
                'source',
                'style',
                'textarea',
                'track',
                'video',
            ],
            FORBID_ATTR: ['action', 'autofocus', 'formaction', 'srcset'],
        });
    }
</script>

<article class:expanded class:unread={message.unread} class="conversation-message">
    <button
        class="message-header"
        aria-expanded={expanded}
        onclick={onToggle}
    >
        <SenderAvatar sender={message.sender} size={34}/>
        <span class="header-copy">
            <span class="sender-row">
                <span class="sender-name">{formatSenderName(message.sender)}</span>
                <span class="message-date" title={message.date}>{formattedDate}</span>
            </span>
            {#if !expanded}
                <span class="message-preview">{message.preview || 'No message preview'}</span>
            {:else}
                <span class="sender-address">{message.sender ?? 'Unknown sender'}</span>
            {/if}
        </span>
<!--        <span class="icon expand-icon">{expanded ? 'expand_less' : 'expand_more'}</span>-->
    </button>

    {#if expanded}
        <div class="message-details">
            {#if message.attachments.length}
                <div class="attachments">
                    {#each message.attachments as attachment (attachment.id ?? attachment.filename)}
                        <button
                            class="attachment"
                            disabled={!attachment.id || downloadingAttachmentId === attachment.id}
                            onclick={() => handleAttachmentDownload(attachment)}
                        >
                            <span class="icon">attach_file</span>
                            <span class="attachment-name">{attachment.filename}</span>
                            <span class="attachment-size">{formatAttachmentSize(attachment.size)}</span>
                        </button>
                    {/each}
                </div>
            {/if}

            {#if message.html}
                <div class="message-body html-body">{@html sanitizedHtml}</div>
            {:else if message.text}
                <div class="message-body plain-text">{message.text}</div>
            {:else}
                <span class="empty-body">No message body found.</span>
            {/if}
        </div>
    {/if}
</article>

<style>
    .conversation-message {
        overflow: hidden;
    }

    /*.conversation-message.unread:not(.expanded) {*/
    /*    border-left: 3px solid #e083ff;*/
    /*}*/

    .message-header {
        align-items: center;
        background: transparent;
        border-radius: 0;
        color: inherit;
        display: flex;
        gap: 10px;
        justify-content: flex-start;
        margin: 0;
        padding: 8px;
        text-align: left;
        width: 100%;
        font-weight: 400;
    }

    .message-header:hover {
        background-color: rgba(0, 0, 0, 0.1);
    }

    .header-copy {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
    }

    .sender-row {
        align-items: baseline;
        display: flex;
        gap: 12px;
        justify-content: space-between;
    }

    .sender-name {
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .message-date,
    .sender-address,
    .message-preview {
        color: rgba(255, 255, 255, 0.62);
        font-size: 0.82rem;
    }

    .message-date {
        flex: 0 0 auto;
    }

    .sender-address,
    .message-preview {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .message-details {
        border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .message-body {
        box-sizing: border-box;
        display: block;
        width: 100%;
    }

    .html-body {
        contain: content;
        isolation: isolate;
        line-height: 1.5;
        overflow-wrap: anywhere;
    }

    .html-body :global(img) {
        height: auto;
        max-width: 100%;
    }

    .html-body :global(pre) {
        overflow-wrap: anywhere;
        white-space: pre-wrap;
    }

    .html-body :global(p:first-child) {
        margin-top: 0;
    }

    .html-body :global(p:last-child) {
        margin-bottom: 0;
    }

    .plain-text {
        line-height: 1.5;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
    }

    .empty-body {
        color: rgba(255, 255, 255, 0.6);
        display: block;
        padding-top: 14px;
    }

    .attachments {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        padding-top: 11px;
    }

    .attachment {
        margin: 0;
        max-width: 100%;
    }

    .attachment-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .attachment-size {
        opacity: 0.7;
    }

    @media (max-width: 500px) {
        .message-header {
            padding: 10px 8px;
        }

        .message-date {
            max-width: 105px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .message-details {
            padding-inline: 8px;
        }
    }
</style>
