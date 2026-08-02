<script lang="ts">
    import {getContext} from "svelte";
    import type {ToastContent, ToastService} from "../services/ToastService.svelte";
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
            <button onclick={() => toastService.info({message: "Composition and reply features are not yet implemented."})}>
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

<style>
    /* Sidebar */
    #sidebar .item {
        display: flex;
        gap: 10px;
        padding: 5px;
        align-items: center;
        width: 100%;
        margin: 0;
        color: inherit;
        background: transparent;
        justify-content: flex-start;
        box-sizing: border-box;
        text-decoration: none;
    }

    #sidebar .item:hover {
        background-color: rgba(0, 0, 0, 0.1);
    }

    #sidebar {
        display:flex;
        flex-direction: column;
        max-width: fit-content;
        background-color: rgba(0, 0, 0, 0.15);
        padding: 15px;
        min-width: 150px;
        gap: 3px;
        justify-content: space-between;
        box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.5);
    }

    #sidebar .selected {
        color: #e083ff;
    }

    @media (max-width: 1500px) {

        #sidebar {
            min-width: 30px;
            contain: size;
            padding: 5px;
            overflow: hidden;
        }

        #sidebar .label {
            display: none;
        }

        #sidebar button {
            padding: 2px 3px;
        }

        #sidebar .icon {
            font-size: larger;
        }
    }

    button {
        margin-bottom: 12px;
    }
</style>