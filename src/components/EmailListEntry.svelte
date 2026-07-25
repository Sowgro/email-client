<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import {PanelService} from "../services/PanelService.svelte";
    import EmailView from "./EmailView.svelte";
    import type {ParsedMessage} from "../services/GmailService";

    let {
        message,
        selected = false,
        onMessageChanged,
    }: {
        message: ParsedMessage,
        selected?: boolean,
        onMessageChanged?: (
            messageId: string,
            changes: Partial<ParsedMessage>,
            removeFromList?: boolean,
        ) => void,
    } = $props();
    let ps: PanelService = getContext(Context.PANEL_SERVICE)

    const openPanel = () => {
        ps.panels = [ps.panels[0]]
        ps.addPanel({component: EmailView, props: {message, onMessageChanged}})
    }

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPanel();
        }
    }

</script>

<div class:selected class="email" role="button" tabindex="0" onclick={openPanel} onkeydown={handleKeydown}>
    <span class="sender">{message.sender ?? "Unknown sender"}</span>
    <div class="content">
        <span class="subject">{message.subject ?? "No subject"}</span>
        <span class="preview"> — {message.preview}</span>
    </div>
    <span class="date">{message.date ?? "??"}</span>
</div>

<style>
    .sender, .content, .date {
        /*display: flex;*/
        white-space: nowrap;
        overflow: hidden;
    }

    .sender {
        min-width: 20%;
    }

    .date {
        width: 100px;
    }

    .content {
        width: 100%;
    }

    .preview {
        width: 20%;
    }

    .email {
        padding: 7px;
        display: flex;
        gap:30px;
    }

    .email.selected {
        background-color: rgba(224, 131, 255, 0.1);
    }

    .email.selected:hover {
        background-color: rgba(112, 67, 128, 0.1);
    }

    .email:hover {
        background-color: rgba(0, 0, 0, 0.1);
    }

    .email .preview {
        color: rgba(239, 239, 239, 0.5);
    }
</style>
