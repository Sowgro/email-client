<script lang="ts">
    import EmailList from "../components/EmailList.svelte";
    import {PanelService} from "../services/PanelService.svelte";
    import {setContext} from "svelte";
    import {Context} from "../Context";

    let ps = new PanelService()
    setContext(Context.PANEL_SERVICE, ps)

    ps.addPanel({ component: EmailList, props: { id: 0 } })
</script>

<div id="header">
    <div class="left">
        Saturday, May 18
    </div>
    <div class="middle">
        <input type="text" placeholder="Search Mail">
    </div>
    <div class="right">
        <span>demo@sowgro.net ▾</span>
    </div>
</div>
<div id="not-header">
    <div id="sidebar">
        <div id="top">
            <button>
                <span class="icon">edit</span>
                <span class="label">Compose</span>
            </button>
            <div class="item selected">
                <span class="icon">inbox</span>
                <span class="label">Inbox</span>
            </div>
            <div class="item">
                <span class="icon">check</span>
                <span class="label">Done</span>
            </div>
            <div class="item">
                <span class="icon">draft</span>
                <span class="label">Drafts</span>
            </div>
            <div class="item">
                <span class="icon">send</span>
                <span class="label">Sent</span>
            </div>
            <div class="item">
                <span class="icon">delete</span>
                <span class="label">Trash</span>
            </div>
            <div class="item">
                <span class="icon">report</span>
                <span class="label">Spam</span>
            </div>
        </div>
        <div id="bottom">
            <div class="item">
                <span class="icon">settings</span>
                <span class="label">Settings</span>
            </div>
        </div>
    </div>
    <div id="main">
        <div class="scroll" id="panels">
            {#each ps.panels as { component: Component, props }}
                <Component {...props} />
            {/each}
        </div>
    </div>
</div>