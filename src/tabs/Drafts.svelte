<script lang="ts">
    import PanelHost from "../components/PanelHost.svelte";
    import EmailList from "../components/EmailList.svelte";
</script>

<PanelHost>
    <EmailList options={{labelIds: ['DRAFT']}} groupByDate groupPins/>
</PanelHost>
