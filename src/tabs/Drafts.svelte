<script lang="ts">
    import PanelHost from "../components/PanelHost.svelte";
    import EmailList from "../components/EmailList.svelte";
    import type {ComponentEntry} from "../services/PanelService.svelte";

    let initPanel: ComponentEntry = {component: EmailList, props: {id: 2, labelIds: ['DRAFT'], mailbox: "Drafts"}}
</script>

<PanelHost initPanels={[initPanel]}/>
