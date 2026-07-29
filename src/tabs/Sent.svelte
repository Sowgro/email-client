<script lang="ts">
    import PanelHost from "../components/PanelHost.svelte";
    import EmailList from "../components/EmailList.svelte";
</script>

<PanelHost>
    <EmailList
            id={3}
            labelIds={['SENT']}
            mailbox="Sent"
    />
</PanelHost>