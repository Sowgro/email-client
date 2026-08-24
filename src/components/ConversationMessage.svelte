<script lang="ts">
    import {getContext} from "svelte";
    import type {Action} from "svelte/action";
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

    const autoSizeFrame: Action<HTMLIFrameElement> = (frame) => {
        let documentObserver: ResizeObserver | undefined;
        let frameObserver: ResizeObserver | undefined;
        let animationFrameId: number | undefined;
        let shrinkOnNextMeasure = false;
        let lastWidth = frame.clientWidth;

        const measure = (allowShrink = false) => {
            shrinkOnNextMeasure ||= allowShrink;
            if (animationFrameId !== undefined) {
                return;
            }

            animationFrameId = window.requestAnimationFrame(() => {
                animationFrameId = undefined;

                try {
                    const document = frame.contentDocument;
                    if (!document?.body || !document.documentElement) {
                        return;
                    }

                    document.body.style.overflow = 'hidden';
                    document.documentElement.style.overflow = 'hidden';

                    if (shrinkOnNextMeasure) {
                        frame.style.height = '1px';
                        shrinkOnNextMeasure = false;
                    }

                    const height = Math.max(
                        document.body.scrollHeight,
                        document.body.offsetHeight,
                        document.documentElement.scrollHeight,
                        document.documentElement.offsetHeight,
                    );
                    const targetHeight = Math.max(height, 80);

                    if (Math.abs(frame.getBoundingClientRect().height - targetHeight) > 1) {
                        frame.style.height = `${targetHeight}px`;
                    }
                } catch {
                    // Keep the minimum height if a browser denies access to the sandboxed document.
                }
            });
        };

        const observeDocument = () => {
            documentObserver?.disconnect();
            measure(true);

            try {
                const document = frame.contentDocument;
                if (!document?.body || !document.documentElement) {
                    return;
                }

                documentObserver = new ResizeObserver(() => measure());
                documentObserver.observe(document.documentElement);
                documentObserver.observe(document.body);
            } catch {
                // The initial measurement provides the best available fallback.
            }
        };

        frame.addEventListener('load', observeDocument);
        frameObserver = new ResizeObserver(([entry]) => {
            const width = entry.contentRect.width;
            if (Math.abs(width - lastWidth) > 1) {
                lastWidth = width;
                measure(true);
            }
        });
        frameObserver.observe(frame);
        if (frame.contentDocument?.readyState === 'complete') {
            observeDocument();
        }

        return {
            destroy() {
                frame.removeEventListener('load', observeDocument);
                documentObserver?.disconnect();
                frameObserver?.disconnect();
                if (animationFrameId !== undefined) {
                    window.cancelAnimationFrame(animationFrameId);
                }
            },
        };
    };
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
        <span class="icon expand-icon">{expanded ? 'expand_less' : 'expand_more'}</span>
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
                <iframe
                    title={`Message from ${formatSenderName(message.sender)}`}
                    class="message-body html-body"
                    sandbox="allow-same-origin"
                    scrolling="no"
                    srcdoc={message.html}
                    use:autoSizeFrame
                ></iframe>
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
        background: rgba(255, 255, 255, 0.025);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 5px;
        overflow: hidden;
    }

    .conversation-message.expanded {
        background: rgba(255, 255, 255, 0.045);
    }

    .conversation-message.unread:not(.expanded) {
        border-left: 3px solid #e083ff;
    }

    .message-header {
        align-items: center;
        background: transparent;
        border-radius: 0;
        color: inherit;
        display: flex;
        gap: 10px;
        justify-content: flex-start;
        margin: 0;
        padding: 12px;
        text-align: left;
        width: 100%;
    }

    .message-header:hover {
        background: rgba(255, 255, 255, 0.045);
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

    .expand-icon {
        color: rgba(255, 255, 255, 0.6);
        flex: 0 0 auto;
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
        background: white;
        border: 0;
        height: 80px;
        min-height: 80px;
        overflow: hidden;
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
