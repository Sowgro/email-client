<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import {PanelService} from "../services/PanelService.svelte";
    import EmailView from "./EmailView.svelte";
    import {formatError, type ParsedMessage} from "../services/GmailService";
    import {executeMessageAction, getRelevantActions, type MessageAction} from "../MessageActions";
    import type {ToastService} from "../services/ToastService.svelte";

    let {
        message,
        checked = false,
        showCheckbox = false,
        onCheckedChange,
        onMessageChanged,
        onBundleDrop,
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
    } = $props();

    let panelService: PanelService = getContext(Context.PANEL_SERVICE)
    let toastService: ToastService = getContext(Context.TOAST_SERVICE)
    let emailRoot: HTMLDivElement | undefined = $state();
    let dragOver = $state(false);

    const openPanel = () => {
        panelService.openNextTo(emailRoot, emailView);
    }

    const handleClick = (event: MouseEvent) => {
        if (event.target instanceof Element && event.target.closest('.action-group')) {
            return;
        }

        openPanel();
    }

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.target !== event.currentTarget) {
            return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPanel();
        }
    }

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
        dragOver = true;
    };

    const handleDrop = (event: DragEvent) => {
        dragOver = false;
        const sourceMessageId = event.dataTransfer?.getData('application/x-fettuccemail-message');
        if (!sourceMessageId || sourceMessageId === message.id) {
            return;
        }

        event.preventDefault();
        onBundleDrop?.(sourceMessageId, message);
    };

    const runAction = async (action: MessageAction) => {
        try {
            const executed = await executeMessageAction(action, [message.id!]);
            if (!executed) {
                return;
            }

            const selectedReplacement =
                onMessageChanged?.(message.id!, action.changes ?? {}, action.removeFromList) ?? false;

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
        } catch (ex) {
            toastService.error({
                message: `An error occurred while completing action ${action.label}`,
                error: formatError(ex)
            });
        }
    };

</script>

{#snippet emailView()}
    <EmailView {message} {onMessageChanged}/>
{/snippet}

<div
    bind:this={emailRoot}
    class:selected={panelService.panels.includes(emailView)}
    class:selection-visible={showCheckbox || checked}
    class:drag-over={dragOver}
    class="email"
    role="button"
    tabindex="0"
    draggable={Boolean(onBundleDrop) && Boolean(message.id)}
    onclick={handleClick}
    onkeydown={handleKeydown}
    ondragstart={handleDragStart}
    ondragover={handleDragOver}
    ondragleave={() => dragOver = false}
    ondrop={handleDrop}
>
    <div class="action-group left">
        <button
                class="icon-button section-select"
                class:checked={checked}
                onclick={() => onCheckedChange?.(!checked)}
        >
                                <span class="icon">
                                    {checked ? 'check_box': 'check_box_outline_blank'}
                                </span>
        </button>
    </div>
    <span class="sender">{message.sender ?? "Unknown sender"}</span>
    <div class="content">
        <span class="subject">{message.subject ?? "No subject"}</span>
        <span class="preview"> — {message.preview}</span>
    </div>
    <span class="date">{message.date ?? "??"}</span>
    <div class="action-group right">
        {#each actions.slice(0, 3) as action (action.label)}
            <button
                    class:active={action.isActive}
                    class="icon-button"
                    aria-label={action.label}
                    title={action.label}
                    disabled={!message.id}
                    onclick={() => runAction(action)}
            >
                <span class="icon">{action.icon}</span>
            </button>
        {/each}
    </div>
</div>

<style>
    .sender, .content, .date {
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
    }

    .date {
        text-align: right;
    }

    .email {
        padding: 7px;
        display: grid;
        grid-template-columns: 20% minmax(0, 1fr) 100px;
        column-gap: 20px;
        user-select: none;
        position: relative;
    }

    .email:focus {
        outline: none;
    }

    .email.selected {
        background-color: rgba(224, 131, 255, 0.1);
    }

    .email.selected:hover {
        background-color: rgba(112, 67, 128, 0.1);
    }

    .email.drag-over {
        background-color: rgba(224, 131, 255, 0.18);
        box-shadow: inset 0 0 0 2px #e083ff;
    }

    .email:hover {
        background-color: rgba(0, 0, 0, 0.1);
    }

    .email .preview {
        color: rgba(239, 239, 239, 0.5);
    }

    .action-group {
        display: none;
        position: absolute;
        top: 0;
        bottom: 0;
        background-color: #232323;
        padding: 5px;

        &.right {
            right: 0;
        }

        &.left {
            left: 0;
        }
    }

    .email:hover .action-group {
        display: flex;
    }

    .email.selection-visible .action-group.left {
        display: flex;
    }

    .section-select.checked {
        color: #e083ff;
    }
</style>
