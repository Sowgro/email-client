<script lang="ts">
    import PanelHost from "../components/PanelHost.svelte";
    import EmailList from "../components/EmailList.svelte";
    import {Router} from "../services/Router.svelte";
    import {getContext} from "svelte";
    import {Context} from "../Context";

    const router: Router = getContext(Context.ROUTER)

    let query = $derived(
        new URL(router.url, window.location.origin).searchParams.get('q')?.trim() ?? ''
    )
</script>

<PanelHost>
    <EmailList
            {query}
    />
</PanelHost>
