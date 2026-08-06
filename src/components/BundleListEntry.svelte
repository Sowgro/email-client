<script lang="ts">
    import type {ParsedMessage} from "../services/GmailService";

    let {
        representative,
        selected = false,
        onOpen,
        onBundleDrop,
        onRename,
    }: {
        representative: ParsedMessage,
        selected?: boolean,
        onOpen: (bundleLabelId: string, bundleTitle?: string) => void,
        onBundleDrop: (sourceMessageId: string, target: ParsedMessage) => void,
        onRename: (bundleLabelId: string, bundleTitle?: string) => void,
    } = $props();

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

    const openBundle = () => {
        if (representative.bundleLabelId) {
            onOpen(representative.bundleLabelId, representative.bundleTitle);
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

<div
    class:selected
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
    <span class="sender">{representative.bundleTitle ?? 'Untitled bundle'} <span class="count">({count})</span></span>
    <div class="content">{senders}</div>
    <span class="date">{representative.date ?? "??"}</span>
    <div class="action-group right">
        <button
            class="icon-button"
            aria-label="Rename bundle"
            title="Rename bundle"
            onclick={() => representative.bundleLabelId
                && onRename(representative.bundleLabelId, representative.bundleTitle)}
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
        right: 0;
        background-color: #232323;
        padding: 5px;
    }

    .email:hover .action-group {
        display: flex;
    }

    .count {
        color: rgba(239, 239, 239, 0.7);
    }
</style>
