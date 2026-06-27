<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import type PanelService from "../services/PanelService.svelte";
    import type {ParsedMessage} from "../services/GmailService";

    let { message }: { message: ParsedMessage } = $props();
    let ps: PanelService = getContext(Context.PANEL_SERVICE)

    function closePanel() {
        ps.panels.pop();
    }

</script>

<div class="panel anim-test">
    <div class="emailView">
        <div class="action-bar">
            <div class="left">
                <button
                    class="icon-button"
                    tabindex="0"
                    onclick={closePanel}
                >
                    <span class="icon">keyboard_arrow_right</span>
                </button>
            </div>
            <div class="right">
                <span class="icon">more_vert</span>
                <span class="icon">star</span>
                <span class="icon">delete</span>
                <span class="icon">check</span>
            </div>
        </div>
        <span class="subject">{message.subject}</span>
        <span class="sender">From: {message.sender}</span>

        {#if message.html}
            <iframe title="email" class="content" sandbox="" srcdoc={message.html}></iframe>
        {:else if message.text}
            <div class="content plain-text">{message.text}</div>
        {:else}
            <span>No message body found.</span>
        {/if}
    </div>
</div>

<style>
    .emailView {
        display: flex;
        flex-direction: column;
        gap: 5px;
        height: 100%;
    }

    .content {
        display: block;
        overflow: clip;
    }

    .action-bar {
        display: flex;
    }

    .subject, .bundle-name {
        font-size: larger;
    }

    .content {
        padding-top: 20px;
    }

    .plain-text {
        white-space: pre-wrap;
    }
</style>
