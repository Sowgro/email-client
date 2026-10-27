<script lang="ts">
    import type {Snippet} from "svelte";
    import type {MessageAction} from "../MessageActions";

    let props: {
        itemKey: string,
        showCheckbox: boolean,
        checked: boolean,
        onCheckedChange: (checked: boolean) => void,
        unread: boolean
        avatar: Snippet,
        sender: Snippet,
        content: Snippet,
        date: Snippet,
        actions: MessageAction[],
        busy?: boolean,
        runAction: (action: MessageAction) => void,
        selected: boolean
        onSelect: () => void,
        onDragStart?: (event: DragEvent) => void,
        onDragOver: (event: DragEvent) => boolean,
        onDrop: (event: DragEvent) => boolean,
    } = $props()

    let dragOver: boolean = $state(false);

    const handleClick = (event: MouseEvent) => {
        if (event.target instanceof Element && event.target.closest('.action-group')) {
            return;
        }

        props.onSelect();
    }

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.target !== event.currentTarget) {
            return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            props.onSelect();
        }
    }
</script>

<div
        data-item-key={props.itemKey}
        class:selected={props.selected}
        class:selection-visible={props.showCheckbox || props.checked}
        class:drag-over={dragOver}
        class:unread={props.unread}
        class="email"
        role="button"
        tabindex="0"
        draggable={!!props.onDragStart}
        onclick={handleClick}
        onkeydown={handleKeydown}
        ondragstart={props.onDragStart}
        ondragover={e => props.onDragOver(e) && (dragOver = true)}
        ondragleave={() => dragOver = false}
        ondrop={e => {props.onDrop(e); dragOver = false}}
>
    <div class="action-group left">
        <button
                class="icon-button section-select"
                class:checked={props.checked}
                onclick={() => props.onCheckedChange?.(!props.checked)}
        >
            <span class="icon">
                {props.checked ? 'check_box': 'check_box_outline_blank'}
            </span>
        </button>
    </div>
    <div class="sender">
        <div class="avatar">
            {@render props.avatar()}
        </div>
        {@render props.sender()}
    </div>
    <div class="content">
        {@render props.content()}
    </div>
    <div class="date">
        {@render props.date()}
    </div>
    <div class="action-group right">
        {#each props.actions as action (action.label)}
            <button
                    class:active={action.isActive}
                    class="icon-button"
                    aria-label={action.label}
                    title={action.label}
                    disabled={props.busy}
                    onclick={() => props.runAction(action)}
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

    .sender {
        align-items: center;
        display: flex;
        gap: 8px;
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

    .email.selected .action-group {
        background-color: #2e2a30;
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

    .unread :global(span) {
        font-weight: 600;
    }

    .avatar {
        display: flex;
        width: 28px;
        justify-content: center;
        align-items: center;

        :global(.icon) {
            font-size: 22px;
        }
    }
</style>
