<script lang="ts">
    import {type Component, getContext} from "svelte";
    import {Router} from "../services/Router.svelte";
    import Inbox from "../tabs/Inbox.svelte";
    import Done from "../tabs/Done.svelte";
    import Drafts from "../tabs/Drafts.svelte";
    import Sent from "../tabs/Sent.svelte";
    import Trash from "../tabs/Trash.svelte";
    import Spam from "../tabs/Spam.svelte";
    import Search from "../tabs/Search.svelte";
    import Sidebar from "../components/Sidebar.svelte";
    import Header from "../components/Header.svelte";
    import {Context} from "../Context";
    import Settings from "../tabs/Settings.svelte";

    interface Route {path: string, component: Component}

    const routes: Route[] = [
        {path: '/inbox', component: Inbox},
        {path: '/done', component: Done},
        {path: '/drafts', component: Drafts},
        {path: '/sent', component: Sent},
        {path: '/trash', component: Trash},
        {path: '/spam', component: Spam},
        {path: '/search', component: Search},
        {path: '/settings', component: Settings}
    ]

    const router: Router = getContext(Context.ROUTER)

    let activeRoute: Route | undefined = $state()

    $effect(() => {
        let parsedUrl = new URL(router.url, window.location.origin)
        if (parsedUrl.pathname === '/') {
            router.navigate('/inbox')
        } else {
            activeRoute = routes.find((r) => r.path === parsedUrl.pathname)
        }
    })
</script>

<Header/>
<div id="not-header">
    <Sidebar/>
    <div id="main">
        {#if activeRoute}
            <activeRoute.component/>
        {:else}
            <span>Unknown route</span>
        {/if}
    </div>
</div>

<style>
    #not-header {
        display: flex;
        height: 100%;
    }

    #main {
        display: flex;
        width: 100%;
        justify-content: center;
        min-width: 0;
    }

    @media (max-width: 500px) {
        #not-header {
            flex-direction: column-reverse;
        }

        #main {
            height: 100%;
        }
    }
</style>
