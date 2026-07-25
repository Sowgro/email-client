<script lang="ts">
    import type {Snippet} from "svelte";

    let {
        children,
        label = 'More actions',
        disabled = false,
    }: {
        children: Snippet,
        label?: string,
        disabled?: boolean,
    } = $props()

    let open = $state(false)
    let root: HTMLDivElement

    const handleWindowClick = (event: MouseEvent) => {
        if (open && !root.contains(event.target as Node)) {
            open = false
        }
    }

    const handleWindowKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            open = false
        }
    }

    const handleMenuKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            open = false
        }
    }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div class="context-menu" bind:this={root}>
    <button
        class="icon-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        {disabled}
        onclick={() => open = !open}
    >
        <span class="icon">more_vert</span>
    </button>
    {#if open}
        <div class="menu" role="menu" tabindex="-1" onclick={() => open = false} onkeydown={handleMenuKeydown}>
            {@render children()}
        </div>
    {/if}
</div>

<style>
    .context-menu {
        position: relative;
    }

    .menu {
        position: absolute;
        z-index: 2;
        top: 28px;
        right: 0;
        min-width: 180px;
        padding: 3px;
        background: rgba(0, 0, 0, 0.15);
    }

    .menu :global(button) {
        width: 100%;
        margin: 0;
        justify-content: flex-start;
        background: transparent;
        color: white;
    }

    .menu :global(button:hover) {
        background-color: rgba(0, 0, 0, 0.1);
    }
</style>
