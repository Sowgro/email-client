<script lang="ts">
    import PanelHost from "../components/PanelHost.svelte";
    import EmailList from "../components/EmailList.svelte";
    import {Router} from "../services/Router.svelte";
    import {getContext} from "svelte";
    import {Context} from "../Context";

    const router: Router = getContext(Context.ROUTER)

    let query: string | undefined = $state()

    $effect(() => {
        const parsedUrl = new URL(router.url, window.location.origin)
        query = parsedUrl.searchParams.get('q')?.trim()
    })

</script>

<PanelHost>
    <EmailList
            id={6}
            query={query ?? ''}
            mailbox="Search"
    />
</PanelHost>