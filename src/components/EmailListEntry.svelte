<script lang="ts">
    import {getContext, type Snippet} from "svelte";
    import {Context} from "../Context";
    import {PanelService} from "../services/PanelService.svelte";
    import EmailView from "./EmailView.svelte";
    import type {ParsedMessage} from "../services/GmailService";
    import {getRelevantActions, type MessageAction} from "../MessageActions";
    import type {ToastService} from "../services/ToastService.svelte";
    import type {GmailOperationService} from "../services/GmailOperationService.svelte";
    import {formatListDate} from "../DateFormatter";
    import {formatSenderName} from "../SenderFormatter";
    import SenderAvatar from "./SenderAvatar.svelte";
    import ListEntryFrame from "./ListEntryFrame.svelte";
    import {formatConversationSubject} from "../SubjectFormatter";

    let props: {
        message: ParsedMessage,
        threadMessages: ParsedMessage[],
        checked: boolean,
        showCheckbox: boolean,
        onCheckedChange: (checked: boolean) => void,
        onMessagesChanged: (
            messageIds: string[],
            previewOpen?: boolean,
        ) => boolean | undefined,
        onBundleDrop?: (sourceMessageId: string, target: ParsedMessage) => void,
        parentListSnippet: Snippet
    } = $props();

    let panelService: PanelService = getContext(Context.PANEL_SERVICE)
    let toastService: ToastService = getContext(Context.TOAST_SERVICE)
    let gmailOperations: GmailOperationService = getContext(Context.GMAIL_OPERATION_SERVICE)

    const actions = $derived(getRelevantActions(props.message));
    const unread = $derived(props.threadMessages.some((threadMessage) => threadMessage.unread));
    const subject = $derived(formatConversationSubject(props.threadMessages, props.message.subject));

    const handleDragStart = (event: DragEvent) => {
        if (!props.message.id || !event.dataTransfer) {
            event.preventDefault();
            return;
        }

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-fettuccemail-message', props.message.id);
    };

    const handleDragOver = (event: DragEvent) => {
        if (
            !props.onBundleDrop
            || !event.dataTransfer?.types.includes('application/x-fettuccemail-message')
        ) {
            return false;
        }

        const sourceMessageId = event.dataTransfer?.getData('application/x-fettuccemail-message');
        if (!sourceMessageId || sourceMessageId === props.message.id) {
            return false;
        }

        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        return true;
    };

    const handleDrop = (event: DragEvent) => {
        const sourceMessageId = event.dataTransfer?.getData('application/x-fettuccemail-message');
        if (!sourceMessageId || sourceMessageId === props.message.id) {
            return false;
        }

        event.preventDefault();
        props.onBundleDrop?.(sourceMessageId, props.message);
        return true;
    };

    const runAction = async (action: MessageAction) => {
        const messageIds = props.threadMessages.flatMap(({id}) => id ? [id] : []);
        if (!messageIds.length) {
            return;
        }

        const executed = await gmailOperations.runBulkMessageAction(action, messageIds, {
            onOptimistic: () => handleOptimisticChange(messageIds),
        });
        if (!executed) {
            return;
        }

        toastService.success({
            message: messageIds.length === 1
                ? `Success: ${action.label}`
                : `${action.label}: ${messageIds.length} messages`,
        });
    };

    const handleOptimisticChange = (messageIds: string[]) => {
        const previewOpen = panelService.contains(emailView);
        const selectedReplacement = props.onMessagesChanged(messageIds, previewOpen);
        if (selectedReplacement === false && previewOpen) panelService.close(emailView);
    };

</script>

{#snippet emailView()}
    <EmailView
            message={props.message}
            onOptimisticChange={handleOptimisticChange}
    />
{/snippet}

<ListEntryFrame
        itemKey={props.message.threadId ? `thread:${props.message.threadId}` : `message:${props.message.id}`}
        showCheckbox={props.showCheckbox}
        checked={props.checked}
        onCheckedChange={(props.onCheckedChange)!}
        {unread}
        actions={actions.slice(0, 3)}
        runAction={runAction}
        busy={gmailOperations.isPending(props.threadMessages.flatMap(({id}) => id ? [id] : []))}
        selected={panelService.contains(emailView)}
        onSelect={() => panelService.openAfter(props.parentListSnippet, emailView)}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
>
    {#snippet avatar()}
        <SenderAvatar sender={props.message.sender}/>
    {/snippet}
    {#snippet sender()}
        <span class="sender-name">
            {formatSenderName(props.message.sender)}
            {#if props.threadMessages.length > 1}
                <span class="count">({props.threadMessages.length})</span>
            {/if}
        </span>
    {/snippet}
    {#snippet content()}
        <span class="subject">{subject}</span>
        <span class="preview"> — {props.message.preview}</span>
    {/snippet}
    {#snippet date()}
        <span class="date" title={props.message.date}>{formatListDate(props.message.date)}</span>
    {/snippet}
</ListEntryFrame>

<style>
    .preview {
        color: rgba(239, 239, 239, 0.5);
    }
</style>
