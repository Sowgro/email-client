<script lang="ts">
    import {PanelService} from "../services/PanelService.svelte";
    import type {Snippet} from "svelte";
    import type {TransitionConfig} from "svelte/transition";
    import {cubicInOut} from "svelte/easing";
    import {setContext} from "svelte";
    import {Context} from "../Context";

    const PANEL_TRANSITION_DURATION = 300;

    function slidePanel(
        node: HTMLElement,
        {enabled}: {enabled: boolean},
    ): TransitionConfig {
        if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return {duration: 0};
        }

        const finalWidth = node.getBoundingClientRect().width;

        return {
            duration: PANEL_TRANSITION_DURATION,
            easing: cubicInOut,
            css: (progress) => {
                const visibleWidth = finalWidth * progress;

                return `
                    --panel-final-width: ${finalWidth}px;
                    flex: 0 0 ${visibleWidth}px;
                    width: ${visibleWidth}px;
                    min-width: ${visibleWidth}px;
                    max-width: ${visibleWidth}px;
                `;
            },
        };
    }

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
    {#each ps.panels as panel, index (index)}
        <div
            class="panel-slot"
            transition:slidePanel={{enabled: index > 0}}
        >
            {@render panel()}
        </div>
    {/each}
</div>
