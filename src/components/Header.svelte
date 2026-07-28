<script lang="ts">
    import {Router} from "../services/Router.svelte";
    import {getContext} from "svelte";
    import {Context} from "../Context";

    let router: Router = getContext(Context.ROUTER)

    let searchQuery = $state('')

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
