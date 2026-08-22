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

    let {
        message,
        checked = false,
        showCheckbox = false,
        onCheckedChange,
        onMessageChanged,
        onBundleDrop,
        parentListSnippet,
    }: {
        message: ParsedMessage,
        checked?: boolean,
        showCheckbox?: boolean,
        onCheckedChange?: (checked: boolean) => void,
        onMessageChanged?: (
            messageId: string,
            changes: Partial<ParsedMessage>,
            removeFromList?: boolean,
        ) => boolean,
        onBundleDrop?: (sourceMessageId: string, target: ParsedMessage) => void,
        parentListSnippet: Snippet
    } = $props();

    let panelService: PanelService = getContext(Context.PANEL_SERVICE)
    let toastService: ToastService = getContext(Context.TOAST_SERVICE)
    let gmailOperations: GmailOperationService = getContext(Context.GMAIL_OPERATION_SERVICE)

    const actions = $derived(getRelevantActions(message));

    const handleDragStart = (event: DragEvent) => {
        if (!message.id || !event.dataTransfer) {
            event.preventDefault();
            return;
        }

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-fettuccemail-message', message.id);
    };

    const handleDragOver = (event: DragEvent) => {
        if (
            !onBundleDrop
            || !event.dataTransfer?.types.includes('application/x-fettuccemail-message')
        ) {
            return;
        }

        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    };

    const handleDrop = (event: DragEvent) => {
        const sourceMessageId = event.dataTransfer?.getData('application/x-fettuccemail-message');
        if (!sourceMessageId || sourceMessageId === message.id) {
            return;
        }

        event.preventDefault();
        onBundleDrop?.(sourceMessageId, message);
    };

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
            panelService.removePanel(emailView)
        }

        toastService.success({
            message: `Success: ${action.label}`,
            action: {
                label: "Undo",
                fn: () => {/* TODO */}
            }
        });
    };

</script>

{#snippet emailView()}
    <EmailView {message} {onMessageChanged}/>
{/snippet}

<ListEntryFrame
        showCheckbox={showCheckbox}
        checked={checked}
        onCheckedChange={onCheckedChange!}
        unread={message.unread}
        actions={actions.slice(0, 3)}
        runAction={runAction}
        selected={!!panelService.panels.find(i => i === emailView)}
        onSelect={() => panelService.openNextTo(parentListSnippet, emailView)}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
>
    {#snippet avatar()}
        <SenderAvatar sender={message.sender}/>
    {/snippet}
    {#snippet sender()}
        <span class="sender-name">{formatSenderName(message.sender)}</span>
    {/snippet}
    {#snippet content()}
        <span class="subject">{message.subject ?? "No subject"}</span>
        <span class="preview"> — {message.preview}</span>
    {/snippet}
    {#snippet date()}
        <span class="date" title={message.date}>{formatListDate(message.date)}</span>
    {/snippet}
</ListEntryFrame>

<style>
    .preview {
        color: rgba(239, 239, 239, 0.5);
    }
</style>