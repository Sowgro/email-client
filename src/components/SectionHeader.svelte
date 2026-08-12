<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import type {MessageActionService} from "../services/MessageActionService.svelte";

    let props: {
        label: string,
        selectionActive: boolean
        checked: boolean | 'partial',
        onCheckChanged: (checked: boolean) => void,
        onSectionDone?: () => void
    } = $props();

    const messageActionService: MessageActionService = getContext(Context.MESSAGE_ACTION_SERVICE);
</script>

<h2 class="section-heading">
    <span class="section-label">
        <button
                class:selection-visible={props.selectionActive}
                class="icon-button section-select"
                aria-label={`Select all in ${props.label}`}
                title={`Select all in ${props.label}`}
                disabled={messageActionService.busy}
                onclick={() => props.onCheckChanged(props.checked !== true)}
        >
            {#if props.checked === true}
                <span class="icon">check_box</span>
            {:else if props.checked === 'partial'}
                <span class="icon">indeterminate_check_box</span>
            {:else if props.checked === false}
                <span class="icon">check_box_outline_blank</span>
            {/if}
        </button>
        <span>{props.label}</span>
    </span>
    <button
            class="icon-button section-done"
            aria-label={`Mark all in ${props.label} as done`}
            title="Mark all as done"
            disabled={messageActionService.busy || !props.onSectionDone}
            onclick={props.onSectionDone}
    >
        <span class="icon">done_all</span>
    </button>
</h2>

<style>
    .section-heading {
        align-items: center;
        color: rgba(255, 255, 255, 0.62);
        display: flex;
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        margin: 18px 7px 6px;
        text-transform: uppercase;
        justify-content: space-between;
    }

    .section-heading:first-child {
        margin-top: 8px;
    }

    .section-select {
        display: none;
        color: rgba(255, 255, 255, 0.62);
    }

    .section-label {
        align-items: center;
        display: flex;
        gap: 7px;
    }

    .section-done {
        color: rgba(255, 255, 255, 0.62);
    }

    .section-heading:hover .section-select {
        display: flex;
    }

    .section-select.selection-visible {
        display: flex;
    }

    .section-heading .icon-button {
        font-size: 19.2px;
    }
</style>
