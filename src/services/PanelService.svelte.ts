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

    public openNextTo(element: Element | undefined, snippet: Snippet) {
        const panelSlot = element?.closest('.panel-slot');
        const panelSlots = Array.from(document.querySelectorAll('#panels > .panel-slot'));
        const panelIndex = panelSlot ? panelSlots.indexOf(panelSlot) : this.panels.length - 1;
        this.panels = [...this.panels.slice(0, panelIndex + 1), snippet];
    }
}

export {PanelService}
