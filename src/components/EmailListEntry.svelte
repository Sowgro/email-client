<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import {PanelService} from "../services/PanelService.svelte";
    import EmailView from "./EmailView.svelte";
    import {formatError, type ParsedMessage} from "../services/GmailService";
    import {getRelevantActions, type MessageAction} from "../MessageActions";
    import type {ToastService} from "../services/ToastService.svelte";

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

    let panelService: PanelService = getContext(Context.PANEL_SERVICE)
    let toastService: ToastService = getContext(Context.TOAST_SERVICE)

    const openPanel = () => {
        panelService.panels = [panelService.panels[0], emailView]
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

    const actions = getRelevantActions(message);

    const runAction = (action: MessageAction) =>
        action.onAction(message.id!).then(() => {
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
            })
        }).catch((ex) => {
            toastService.error({
                message: `An error occurred while completing action ${action.label}`,
                error: formatError(ex)
            })
        })

</script>

{#snippet emailView()}
    <EmailView {message} {onMessageChanged}/>
{/snippet}

<div class:selected={panelService.panels.includes(emailView)} class="email" role="button" tabindex="0" onclick={handleClick} onkeydown={handleKeydown}>
    <div class="action-group left">
        <input type="checkbox"/>
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
</style>
