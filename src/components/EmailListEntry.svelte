<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import type PanelService from "../services/PanelService.svelte";
    import EmailView from "./EmailView.svelte";

    let { baseMessage }: { baseMessage: gapi.client.gmail.Message } = $props();
    let ps: PanelService = getContext(Context.PANEL_SERVICE)

    const getFullMessage = async () => {
        let fullMessage = (await gapi.client.gmail.users.messages.get({...baseMessage, userId: 'me'})).result;
        return {
            sender: fullMessage.payload?.headers?.find(i => i.name === 'From')?.value,
            subject: fullMessage.payload?.headers?.find(i => i.name === 'Subject')?.value,
            date: fullMessage.payload?.headers?.find(i => i.name === 'Date')?.value,
            preview: fullMessage.snippet?.substring(0, 200).replaceAll('&#39;', "'")
        }
    }

    const openPanel = () => {
        ps.panels = [ps.panels[0]]
        ps.addPanel({component: EmailView, props: { baseMessage: baseMessage }})
        console.log(ps.panels);
    }

</script>

<div class="email" onclick={openPanel}>
    {#await getFullMessage()}
        <span>Loading messages...</span>
    {:then res}
        <span class="sender">{res.sender ?? "Unknown sender"}</span>
        <div class="content">
            <span class="subject">{res.subject ?? "No subject"}</span>
            <span class="preview"> — {res.preview ?? ""}</span>
        </div>
        <span class="date">{res.date ?? "??"}</span>
    {:catch ex}
        <span>Error loading message!</span><code>{ex}</code>
    {/await}
</div>