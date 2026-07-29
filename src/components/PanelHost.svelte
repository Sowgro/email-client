<script lang="ts">
    import {PanelService} from "../services/PanelService.svelte";
    import type {Snippet} from "svelte";
    import {setContext} from "svelte";
    import {Context} from "../Context";

    let ps = new PanelService()
    setContext(Context.PANEL_SERVICE, ps)

    let {
        children
    }: {
        children: Snippet
    } = $props()

    ps.panels = [children];
</script>

<div class="scroll" id="panels">
    {#each ps.panels as panel (panel)}
        {@render panel()}
    {/each}
</div>
