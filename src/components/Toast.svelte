<script lang="ts">
    import type { ToastContent } from "../services/ToastService.svelte";
    import type { ToastKind } from "../services/ToastService.svelte";

    let {
        kind,
        content,
        dismiss
    }: {
        kind: ToastKind,
        content: ToastContent,
        dismiss: () => void
    } = $props();

    const onAction = () => {
        content.action!.fn();
        dismiss();
    }
</script>

<div class="toast {kind}" role={kind === 'error' ? 'alert' : 'status'}>
    <div>
        <span>{content.message}</span>
        {#if content.error}
            <pre>{content.error}</pre>
        {/if}
        {#if content.action}
            <button onclick={onAction}>
                {content.action.label}
            </button>
        {/if}
    </div>
    <button class="icon-button" aria-label="Dismiss notification" onclick={dismiss}>
        <span class="icon">close</span>
    </button>
</div>

<style>
    .toast {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px;
        border-left: 4px solid #8f8f8f;
        color: white;
        background: #3a3a3a;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
        pointer-events: auto;
    }

    .toast.success {
        border-left-color: #69c47c;
    }

    .toast.error {
        border-left-color: #ef6b6b;
    }

    .toast :global(button) {
        flex-shrink: 0;
    }

    button {
        margin-top: 8px
    }
</style>