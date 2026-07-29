<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import {PanelService} from "../services/PanelService.svelte";
    import EmailView from "./EmailView.svelte";
    import type {ParsedMessage} from "../services/GmailService";

    let {
        message,
        mailbox,
        onMessageChanged,
    }: {
        message: ParsedMessage,
        mailbox?: string,
        onMessageChanged?: (
            messageId: string,
            changes: Partial<ParsedMessage>,
            removeFromList?: boolean,
        ) => void,
    } = $props();
    let ps: PanelService = getContext(Context.PANEL_SERVICE)

    const openPanel = () => {
        ps.panels = [ps.panels[0], emailView]
    }

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPanel();
        }
    }

</script>

{#snippet emailView()}
    <EmailView {message} {mailbox} {onMessageChanged}/>
{/snippet}

<div class:selected={ps.panels.includes(emailView)} class="email" role="button" tabindex="0" onclick={openPanel} onkeydown={handleKeydown}>
    <span class="sender">{message.sender ?? "Unknown sender"}</span>
    <div class="content">
        <span class="subject">{message.subject ?? "No subject"}</span>
        <span class="preview"> — {message.preview}</span>
    </div>
    <span class="date">{message.date ?? "??"}</span>
</div>

<style>
    .sender, .content, .date {
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
    }

    .date {
        text-align: right;
    }

    .email {
        padding: 7px;
        display: grid;
        grid-template-columns: 20% minmax(0, 1fr) 100px;
        column-gap: 20px;
        user-select: none;
    }

    .email:focus {
        outline: none;
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
