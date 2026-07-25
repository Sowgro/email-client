<script lang="ts">
    import EmailList from "../components/EmailList.svelte";
    import {PanelService} from "../services/PanelService.svelte";
    import {getContext, onDestroy, setContext} from "svelte";
    import {Context} from "../Context";
    import Settings from "../components/Settings.svelte";
    import {Router} from "../services/Router.svelte";
    import type {ToastService} from "../services/ToastService.svelte";

    let ps = new PanelService()
    setContext(Context.PANEL_SERVICE, ps)

    type Destination = {
        name: string;
        icon: string;
        path: string;
        query?: string;
        labelIds?: string[];
    }

    const destinations: Destination[] = [
        {name: 'Inbox', icon: 'inbox', path: '/inbox', labelIds: ['INBOX']},
        {name: 'Done', icon: 'check', path: '/done', query: 'in:archive'},
        {name: 'Drafts', icon: 'draft', path: '/drafts', labelIds: ['DRAFT']},
        {name: 'Sent', icon: 'send', path: '/sent', labelIds: ['SENT']},
        {name: 'Trash', icon: 'delete', path: '/trash', labelIds: ['TRASH']},
        {name: 'Spam', icon: 'report', path: '/spam', labelIds: ['SPAM']},
    ]

    const router = new Router()
    let activeDestination = $state('Inbox')
    let searchQuery = $state('')
    let panelId = 0

    let toastService: ToastService = getContext(Context.TOAST_SERVICE)

    const renderMailbox = (destination: Destination) => {
        activeDestination = destination.name
        ps.setPanel({
            component: EmailList,
            props: {
                id: ++panelId,
                // title: destination.name,
                mailbox: destination.name,
                query: destination.query,
                labelIds: destination.labelIds,
            },
        })
    }

    const search = () => {
        const query = searchQuery.trim()
        if (!query) {
            router.navigate(destinations[0].path)
            return
        }

        router.navigate(`/search?q=${encodeURIComponent(query)}`)
    }

    const renderRoute = (url: string) => {
        const parsedUrl = new URL(url, window.location.origin)
        const destination = destinations.find(({path}) => path === parsedUrl.pathname)

        if (destination) {
            searchQuery = ''
            renderMailbox(destination)
            return
        }

        if (parsedUrl.pathname === '/search') {
            const query = parsedUrl.searchParams.get('q')?.trim() ?? ''
            if (!query) {
                router.navigate('/inbox', true)
                return
            }

            searchQuery = query
            activeDestination = 'Search'
            ps.setPanel({
                component: EmailList,
                props: {id: ++panelId, title: `Search: ${query}`, query},
            })
            return
        }

        if (parsedUrl.pathname === '/settings') {
            searchQuery = ''
            activeDestination = 'Settings'
            ps.setPanel({component: Settings, props: {id: ++panelId}})
            return
        }

        router.navigate('/inbox', true)
    }

    $effect(() => {
        renderRoute(router.url)
    })

    onDestroy(() => router.destroy())
</script>

<div id="header">
    <div class="left">
        Saturday, May 18
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
        <span>demo@sowgro.net ▾</span>
    </div>
</div>
<div id="not-header">
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
                    class:selected={activeDestination === destination.name}
                    aria-current={activeDestination === destination.name ? 'page' : undefined}
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
                class:selected={activeDestination === 'Settings'}
                aria-current={activeDestination === 'Settings' ? 'page' : undefined}
                onclick={(event) => router.followLink(event, '/settings')}
            >
                <span class="icon">settings</span>
                <span class="label">Settings</span>
            </a>
        </div>
    </div>
    <div id="main">
        <div class="scroll" id="panels">
            {#each ps.panels as { component: Component, props } (props.id)}
                <Component {...props} />
            {/each}
        </div>
    </div>
</div>
