<script lang="ts">
    import type {ToastService} from "../services/ToastService.svelte";
    import Toast from "./Toast.svelte";

    let {service}: {service: ToastService} = $props()
</script>

<div class="toast-host" aria-live="polite" aria-atomic="false">
    {#each service.toasts as toast (toast.id)}
        <Toast {...toast} dismiss={() => service.dismiss(toast.id)}/>
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
</style>
