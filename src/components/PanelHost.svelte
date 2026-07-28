<script lang="ts">
    import {type ComponentEntry, PanelService} from "../services/PanelService.svelte";
    import {setContext} from "svelte";
    import {Context} from "../Context";

    let ps = new PanelService()
    setContext(Context.PANEL_SERVICE, ps)

    let {
        initPanels = []
    }: {
        initPanels: ComponentEntry[]
    } = $props()

    ps.panels = initPanels;
</script>

<div class="scroll" id="panels">
    {#each ps.panels as { component: Component, props } (props.id)}
        <Component {...props} />
    {/each}
</div>