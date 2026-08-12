<script lang="ts">
    import {formatError, listMessagePage, type ParsedMessage} from "../services/GmailService";
    import type {MessageAction} from "../MessageActions";
    import {PanelService} from "../services/PanelService.svelte";
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import {renameBundle} from "../services/BundleService";
    import EmailList from "./EmailList.svelte";
    import type {BundleListItem} from "../EmailListItem";
    import type {ToastService} from "../services/ToastService.svelte";

    let {
        representative,
        bundleListItem,
        checked = false,
        showCheckbox = false,
        actions = [],
        onBundleDrop,
        onCheckedChange,
        onRunAction,
    }: {
        representative: ParsedMessage,
        bundleListItem: BundleListItem,
        checked?: boolean,
        showCheckbox?: boolean,
        actions?: MessageAction[],
        onBundleDrop: (sourceMessageId: string, target: ParsedMessage) => void,
        onCheckedChange?: (checked: boolean) => void,
        onRunAction: (action: MessageAction) => void,
    } = $props();

    let actionBusy = false; // TODO

    let panelService: PanelService = getContext(Context.PANEL_SERVICE)
    let toastService: ToastService = getContext(Context.TOAST_SERVICE)

    let emailRoot: HTMLDivElement | undefined = $state();
    let bundling: boolean = $state(false)

    let dragOver = $state(false);
    const count = $derived(
        representative.bundleSummary?.hasMore
            ? '25+'
            : String(representative.bundleSummary?.count ?? 1)
    );
    const senders = $derived(
        representative.bundleSummary?.senders.join(', ')
        || representative.sender
        || 'Unknown sender'
    );

    const requestBundleTitle = (initialTitle = ''): string | undefined => {
        const title = window.prompt('Name this bundle', initialTitle)?.trim();
        if (title === '') {
            toastService.error({message: 'Bundle names cannot be empty'});
            return undefined;
        }
        return title;
    };

    const handleBundleRename = async (bundleLabelId: string, bundleTitle?: string) => {
        if (bundling) {
            return;
        }

        const title = requestBundleTitle(bundleTitle ?? 'Untitled bundle');
        if (!title || title === bundleTitle) {
            return;
        }

        bundling = true;
        try {
            await renameBundle(bundleLabelId, title);
            // messages = messages.map((listedMessage) =>
            //     listedMessage.bundleLabelId === bundleLabelId
            //         ? {...listedMessage, bundleTitle: title}
            //         : listedMessage
            // );
            toastService.success({message: 'Bundle renamed'});
        } catch (ex) {
            toastService.error({
                message: 'Failed to rename bundle',
                error: formatError(ex),
            });
        } finally {
            bundling = false;
        }
    };

    const openBundle = () => {
        if (representative.bundleLabelId) {
            panelService.openNextTo(emailRoot, bundleList);
        }
    };

    const handleClick = (event: MouseEvent) => {
        if (event.target instanceof Element && event.target.closest('.action-group')) {
            return;
        }

        openBundle();
    };

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.target !== event.currentTarget) {
            return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openBundle();
        }
    };

    const handleDragOver = (event: DragEvent) => {
        if (!event.dataTransfer?.types.includes('application/x-fettuccemail-message')) {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        dragOver = true;
    };

    const handleDrop = (event: DragEvent) => {
        dragOver = false;
        const sourceMessageId = event.dataTransfer?.getData('application/x-fettuccemail-message');
        if (!sourceMessageId) {
            return;
        }

        event.preventDefault();
        onBundleDrop(sourceMessageId, representative);
    };
</script>

{#snippet bundleList()}
    {#if bundleListItem.bundleLabelId}
        <EmailList
                getMessages={(pageToken?: string) => listMessagePage({
                pageToken,
                labelIds: [bundleListItem.bundleLabelId!],
                includeSpamTrash: true,
                includeBundleSummaries: false,
            })}
                groupByDate
                parseBundles={false}
                bundleTitle={bundleListItem.bundleTitle ?? 'Untitled bundle'}
        />
    {/if}
{/snippet}

<div
    bind:this={emailRoot}
    class:selected={panelService.panels.includes(bundleList)}
    class:selection-visible={showCheckbox || checked}
    class:drag-over={dragOver}
    class="email bundle"
    role="button"
    tabindex="0"
    onclick={handleClick}
    onkeydown={handleKeydown}
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
    <span class="sender">{representative.bundleTitle ?? 'Untitled bundle'} <span class="count">({count})</span></span>
    <div class="content">{senders}</div>
    <span class="date">{representative.date ?? "??"}</span>
    <div class="action-group right">
        {#each actions as action (action.label)}
            <button
                class:active={action.isActive}
                class="icon-button"
                aria-label={`${action.label} for bundle`}
                title={action.label}
                disabled={actionBusy}
                onclick={() => onRunAction(action)}
            >
                <span class="icon">{action.icon}</span>
            </button>
        {/each}
        <button
            class="icon-button"
            aria-label="Rename bundle"
            title="Rename bundle"
            disabled={actionBusy}
            onclick={() => representative.bundleLabelId
                && handleBundleRename(representative.bundleLabelId, representative.bundleTitle)}
        >
            <span class="icon">edit</span>
        </button>
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

    .email.bundle {
        cursor: pointer;
    }

    .email:hover {
        background-color: rgba(0, 0, 0, 0.1);
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

    .count {
        color: rgba(239, 239, 239, 0.7);
    }

    .section-select.checked {
        color: #e083ff;
    }
</style>
