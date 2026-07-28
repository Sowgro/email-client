<script lang="ts">
    import PanelHost from "../components/PanelHost.svelte";
    import EmailList from "../components/EmailList.svelte";
    import {Router} from "../services/Router.svelte";
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import type {ComponentEntry} from "../services/PanelService.svelte";

    const router: Router = getContext(Context.ROUTER)

    let query: string | undefined = $state()
    let initPanel: ComponentEntry = {
        component: EmailList,
        props: {
            id: 6,
            get query() {
                return query ?? ''
            },
            mailbox: "Search"
        }
    }

    $effect(() => {
        const parsedUrl = new URL(router.url, window.location.origin)
        query = parsedUrl.searchParams.get('q')?.trim()
    })

</script>

<PanelHost initPanels={[initPanel]}/>
