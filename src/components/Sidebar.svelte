<script lang="ts">
    import {getContext} from "svelte";
    import type {ToastService} from "../services/ToastService.svelte";
    import {Context} from "../Context";
    import {Router} from "../services/Router.svelte";

    let toastService: ToastService = getContext(Context.TOAST_SERVICE)
    let router: Router = getContext(Context.ROUTER)
    let activeDestination = $state()

    $effect(() => {
        const parsedUrl = new URL(router.url, window.location.origin)
        activeDestination = parsedUrl.pathname
    })

    const destinations: {name: string, icon: string, path: string}[] = [
        {name: 'Inbox', icon: 'inbox', path: '/inbox'},
        {name: 'Done', icon: 'check', path: '/done'},
        {name: 'Drafts', icon: 'draft', path: '/drafts'},
        {name: 'Sent', icon: 'send', path: '/sent'},
        {name: 'Trash', icon: 'delete', path: '/trash'},
        {name: 'Spam', icon: 'report', path: '/spam'},
    ];

</script>

<div id="sidebar">
        <div id="top">
            <button onclick={() => toastService.show("Composition and reply features are not yet implemented.")}>
                <span class="icon">edit</span>
                <span class="label">Compose</span>
            </button>
            {#each destinations as destination}
                <a
                    href={destination.path}
                    class="item"
                    class:selected={activeDestination === destination.path}
                    aria-current={activeDestination === destination.path ? 'page' : undefined}
                    onclick={(event) => router.followLink(event, destination.path)}
                >
                    <span class="icon">{destination.icon}</span>
                    <span class="label">{destination.name}</span>
                </a>
            {/each}
        </div>
        <div id="bottom">
            <a
                href="/settings"
                class="item"
                class:selected={activeDestination === '/settings'}
                aria-current={activeDestination === '/settings' ? 'page' : undefined}
                onclick={(event) => router.followLink(event, '/settings')}
            >
                <span class="icon">settings</span>
                <span class="label">Settings</span>
            </a>
        </div>
    </div>