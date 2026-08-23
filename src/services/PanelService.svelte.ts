import type {Snippet} from "svelte";

class PanelService {
    public panels: Snippet[] = $state([])

    constructor(
        private initialPanel: Snippet
    ) {
        this.panels = [this.initialPanel]
    }

    public closeLast() {
        this.panels.pop();
    }

    public openAfter(target: Snippet, after: Snippet) {
        let panelIndex = this.panels.indexOf(target)
        this.panels = [...this.panels.slice(0, panelIndex + 1), after];
    }

    // Closes the target panel and all panels after it
    public close(target: Snippet) {
        let panelIndex = this.panels.indexOf(target)
        if (panelIndex < 0) {
            return;
        }
        this.panels = this.panels.slice(0, panelIndex)
    }

    public contains = (target: Snippet) => !!this.panels.find(i => i === target);

    public getPanelCount = () => this.panels.length;

    public getInitialPanel = () => this.initialPanel;

    public getPanels = () => [...this.panels]
}

export {PanelService}
