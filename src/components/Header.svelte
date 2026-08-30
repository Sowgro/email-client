<script lang="ts">
    import {Router} from "../services/Router.svelte";
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import {AuthService} from "../services/AuthService.svelte";
    import ContextMenu from "./ContextMenu.svelte";
    import {GmailOperationService} from "../services/GmailOperationService.svelte";
    import {ToastService} from "../services/ToastService.svelte";

    let router: Router = getContext(Context.ROUTER)
    let auth: AuthService = getContext(Context.AUTH_SERVICE)
    let operationService: GmailOperationService = getContext(Context.GMAIL_OPERATION_SERVICE)
    let toastService: ToastService = getContext(Context.TOAST_SERVICE)

    let searchQuery = $state('')

    const isCurrentAccount = (emailAddress: string) =>
        emailAddress.toLowerCase() === auth.profile?.emailAddress.toLowerCase()

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

    const switchAccount = async (emailAddress: string) => {
        const switched = await auth.switchAccount(emailAddress)
        if (!switched && auth.error) {
            toastService.error({
                message: 'Could not switch accounts',
                error: auth.error,
            })
        }
    }

    const addAccount = async () => {
        const added = await auth.addAccount()
        if (!added && auth.error) {
            toastService.error({
                message: 'Could not add account',
                error: auth.error,
            })
        }
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
            {#snippet trigger({open, toggle})}
                <button
                    class="icon-button dropdown"
                    aria-label="Account menu"
                    aria-haspopup="menu"
                    aria-expanded={open}
                    onclick={toggle}
                >
                    <span class="icon sync-icon" class:active="{operationService.busy}">sync</span>
                    {auth.profile?.emailAddress ?? 'Google account'}
                    <span class="icon" aria-hidden="true">arrow_drop_down</span>
                </button>
            {/snippet}
            {#each auth.accounts as account (account.emailAddress)}
                <button
                    role="menuitemradio"
                    class="account-option"
                    class:selected={isCurrentAccount(account.emailAddress)}
                    aria-checked={isCurrentAccount(account.emailAddress)}
                    disabled={auth.busy || operationService.busy}
                    onclick={() => switchAccount(account.emailAddress)}
                >
                    <span class="icon" aria-hidden="true">account_circle</span>
                    <span class="account-email">{account.emailAddress}</span>
                </button>
            {/each}
            <span class="menu-separator" role="separator"></span>
            <button role="menuitem" disabled={auth.busy || operationService.busy} onclick={addAccount}>
                <span class="icon" aria-hidden="true">person_add</span>
                Add account
            </button>
            <button role="menuitem" disabled={auth.busy} onclick={() => auth.signOut()}>
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

    .account-option {
        max-width: 300px;

        &.selected {
            color: #e083ff;
        }
    }

    .account-email {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .menu-separator {
        display: block;
        height: 1px;
        margin: 3px 6px;
        background: rgba(255, 255, 255, 0.15);
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
        opacity: 0;

        &.active {
            animation: spin 2s linear infinite;
            opacity: 1;
        }
    }

    input[type=text] {
        background-color: transparent;
        border-style: solid;
        border-radius: 5px;
        border-color: rgba(255, 255, 255, 0.31);
        border-width: 1px;
        color: white;
        width: 100%;
        font-family: inherit;
        text-align: center;
        padding: 2px;
        font-size: inherit;
        flex-grow: 3;
    }

    @media (max-width: 500px) {
        #header {
            flex-wrap: wrap;
        }

        #header .middle {
            order: 1;
            width: 100%;
            min-width: 0;
            margin-top: 5px;
        }

        input[type='text'] {
            margin: 0 -5px;
        }
    }
</style>
