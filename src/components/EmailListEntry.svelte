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

    let props: {
        message: ParsedMessage,
        checked: boolean,
        showCheckbox: boolean,
        onCheckedChange: (checked: boolean) => void,
        onMessageChanged: (
            messageId: string,
            changes: Partial<ParsedMessage>,
            removeFromList?: boolean,
            previewOpen?: boolean,
        ) => boolean,
        onBundleDrop?: (sourceMessageId: string, target: ParsedMessage) => void,
        parentListSnippet: Snippet
    } = $props();

    let panelService: PanelService = getContext(Context.PANEL_SERVICE)
    let toastService: ToastService = getContext(Context.TOAST_SERVICE)
    let gmailOperations: GmailOperationService = getContext(Context.GMAIL_OPERATION_SERVICE)

    const actions = $derived(getRelevantActions(props.message));

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
        if (!props.message.id) {
            return;
        }

        const executed = await gmailOperations.runMessageAction(action, props.message.id);
        if (!executed) {
            return;
        }

        const previewOpen = panelService.contains(emailView);
        const selectedReplacement = props.onMessageChanged?.(
            props.message.id,
            action.changes ?? {},
            action.removeFromList,
            previewOpen,
        ) ?? false;

        if (action.removeFromList && previewOpen && !selectedReplacement) {
            panelService.close(emailView)
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
    <EmailView
            message={props.message}
            onMessageChanged={(messageId, changes, removeFromList) => props.onMessageChanged(
                messageId,
                changes,
                removeFromList,
                panelService.contains(emailView),
            )}
    />
{/snippet}

<ListEntryFrame
        showCheckbox={props.showCheckbox}
        checked={props.checked}
        onCheckedChange={(props.onCheckedChange)!}
        unread={props.message.unread}
        actions={actions.slice(0, 3)}
        runAction={runAction}
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
        <span class="sender-name">{formatSenderName(props.message.sender)}</span>
    {/snippet}
    {#snippet content()}
        <span class="subject">{props.message.subject ?? "No subject"}</span>
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
