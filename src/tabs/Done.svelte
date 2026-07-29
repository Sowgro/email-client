<script lang="ts">
    import PanelHost from "../components/PanelHost.svelte";
    import EmailList from "../components/EmailList.svelte";
</script>

<PanelHost>
    <EmailList
            id={1}
            query="in:archive"
            mailbox="Done"
    />
</PanelHost>