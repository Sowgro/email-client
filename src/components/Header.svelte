<script lang="ts">
    import {Router} from "../services/Router.svelte";
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import {AuthService} from "../services/AuthService.svelte";
    import ContextMenu from "./ContextMenu.svelte";
    import {GmailOperationService} from "../services/GmailOperationService.svelte";

    let router: Router = getContext(Context.ROUTER)
    let auth: AuthService = getContext(Context.AUTH_SERVICE)
    let operationService: GmailOperationService = getContext(Context.GMAIL_OPERATION_SERVICE)

    let searchQuery = $state('')

    const currentDate = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    }).format(new Date())

    $effect(() => {
        const url = new URL(router.url, window.location.origin)

        if (url.pathname === '/search') {
            searchQuery = url.searchParams.get('q') ?? ''
        } else {
            searchQuery = ''
        }
    })

    const search = () => {
        const query = searchQuery.trim()
        if (!query) {
            return
        }
        router.navigate(`/search?q=${encodeURIComponent(query)}`)
    }
</script>

<div id="header">
    <div class="left">
        {currentDate}
    </div>
    <div class="middle">
        <form role="search" onsubmit={(event) => { event.preventDefault(); search(); }}>
            <input bind:value={searchQuery} type="text" placeholder="Search Mail" aria-label="Search mail">
            <button class="icon-button search-button" type="submit" aria-label="Search">
                <span class="icon">search</span>
            </button>
        </form>
    </div>
    <div class="right">
        <ContextMenu label="Account menu">
            {#snippet trigger({toggle})}
                <button class="icon-button dropdown" onclick={toggle} >
                    {#if (operationService.busy)}
                        <span class="icon sync-icon">sync</span>
                    {/if}
                    {auth.profile?.emailAddress ?? 'Google account'}
                    <span class="icon" aria-hidden="true">arrow_drop_down</span>
                </button>
            {/snippet}
            <button role="menuitem" onclick={() => auth.signOut()}>
                <span class="icon" aria-hidden="true">logout</span>
                Log out
            </button>
        </ContextMenu>
    </div>
</div>

<style>
    /* Header */
    #header {
        padding: 5px;
        color:white;
        background-color: black;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-left: 10px;
        padding-right: 10px;
    }

    /* Search bar */
    #header .middle {
        width: 40%;
        min-width: 250px;
        /*max-width: 100%*/
    }

    #header form {
        display: flex;
        align-items: center;
        position: relative;
    }

    #header .search-button {
        flex-shrink: 0;
        position: absolute;
        right: 0;
        height: 100%;
        aspect-ratio: 1/1;
    }

    #header form:has(:placeholder-shown) .search-button {
        display: none;
    }

    .right {
        display: flex;
        flex-direction: row;
    }

    .dropdown {
        gap: 0;

        span {
            font-size: 20px;
        }
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    .sync-icon {
        animation: spin 2s linear infinite;
    }
</style>
