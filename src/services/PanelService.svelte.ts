import type {Component} from "svelte";

interface ComponentEntry {
    component: Component<any>;
    props: Record<string, unknown>;
}

class PanelService {
    public panels: ComponentEntry[] = $state([])

    public addPanel(entry: ComponentEntry) {
        this.panels = [...this.panels, entry]
    }
}

export default PanelService
