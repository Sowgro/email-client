<script lang="ts">
    import type {ToastService} from "../services/ToastService.svelte";

    let {service}: {service: ToastService} = $props()
</script>

<div class="toast-host" aria-live="polite" aria-atomic="false">
    {#each service.toasts as toast (toast.id)}
        <div class="toast" class:error={toast.kind === 'error'} class:success={toast.kind === 'success'} role={toast.kind === 'error' ? 'alert' : 'status'}>
            <span>{toast.message}</span>
            <button class="icon-button" aria-label="Dismiss notification" onclick={() => service.dismiss(toast.id)}>
                <span class="icon">close</span>
            </button>
        </div>
    {/each}
</div>

<style>
    .toast-host {
        position: fixed;
        z-index: 1000;
        right: 16px;
        bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: min(380px, calc(100vw - 32px));
        pointer-events: none;
    }

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
</style>
