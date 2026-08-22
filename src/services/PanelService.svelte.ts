import type {Snippet} from "svelte";

class PanelService {
    public panels: Snippet[] = $state([])

    public addPanel(snippet: Snippet) {
        this.panels = [...this.panels, snippet]
    }

    public removePanel(snippet: Snippet) {
        this.panels = this.panels.filter(p => p !== snippet);
    }

    public removeLast() {
        this.panels.pop();
    }

    public openNextTo(target: Snippet, next: Snippet) {
        let panelIndex = this.panels.indexOf(target)
        this.panels = [...this.panels.slice(0, panelIndex + 1), next];
    }
}

export {PanelService}
