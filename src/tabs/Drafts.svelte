<script lang="ts">
    import PanelHost from "../components/PanelHost.svelte";
    import EmailList from "../components/EmailList.svelte";
    import {listMessagePage} from "../services/GmailService";

    const getMessages = async (pageToken?: string) => listMessagePage({
        pageToken,
        labelIds: ['DRAFT'],
    });
</script>

<PanelHost>
    <EmailList {getMessages} groupByDate groupPins/>
</PanelHost>