import type {Snippet} from "svelte";

class PanelService {
    public panels: Snippet[] = $state([])

    public addPanel(snippet: Snippet) {
        this.panels = [...this.panels, snippet]
    }
}

export {PanelService}
