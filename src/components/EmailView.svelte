<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import type PanelService from "../services/PanelService.svelte";

    let { baseMessage }: { baseMessage: gapi.client.gmail.Message } = $props();
    let ps: PanelService = getContext(Context.PANEL_SERVICE)

    const getFullMessage = async () => {
        let fullMessage = (await gapi.client.gmail.users.messages.get({...baseMessage, userId: 'me'})).result
        let sender = fullMessage.payload?.headers?.find(i => i.name === 'From')?.value;
        let subject = fullMessage.payload?.headers?.find(i => i.name === 'Subject')?.value;
        console.log('parts', fullMessage.payload?.parts)
        let content = fullMessage.payload?.parts?.find(i => i.mimeType === 'text/html')?.body?.data
            ?.replace(/-/g, '+').replace(/_/g, '/');
        return {sender, subject, content}
    };

    function closePanel() {
        // let toBeRemoved = ps.panels.find(p => p.props.baseMessage === baseMessage)
        ps.panels.pop();
    }
</script>

<div class="panel anim-test">
    <div class="emailView">
        {#await getFullMessage()}
            <span>Loading message...</span>
        {:then res}
            <div class="action-bar">
                <div class="left">
                    <span class="icon" onclick={closePanel}>keyboard_arrow_right</span>
                </div>
                <div class="right">
                    <span class="icon">more_vert</span>
                    <span class="icon">star</span>
                    <span class="icon">delete</span>
                    <span class="icon">check</span>
                </div>
            </div>
            <span class="subject">{res.subject}</span>
            <span class="sender">From: {res.sender}</span>

            <!--{#if baseMessage.content.html}-->
                <iframe title="email" class="content" src={'data:text/html;base64,'+res.content}></iframe>
            <!--{:else}-->
<!--                <div class="content">{atob(res.content)}</div>-->
            <!--{/if}-->
        {:catch ex}
            <span>Error loading message!</span><code>{ex}</code>
        {/await}
    </div>
</div>