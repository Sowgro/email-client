import type {Snippet} from "svelte";

class PanelService {
    public panels: Snippet[] = $state([])

    public addPanel(snippet: Snippet) {
        this.panels = [...this.panels, snippet]
    }

    public removePanel(snippet: Snippet) {
        this.panels = this.panels.filter(p => p !== snippet);
    }
}

export {PanelService}
