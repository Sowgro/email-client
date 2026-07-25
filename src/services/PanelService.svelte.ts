import type {Component} from "svelte";

interface ComponentEntry {
    component: Component<any>;
    props: Record<string, any>;
}

class PanelService {
    public panels: ComponentEntry[] = $state([])

    public addPanel(entry: ComponentEntry) {
        this.panels = [...this.panels, entry]
    }

    public setPanel(entry: ComponentEntry) {
        this.panels = [entry]
    }
}

export {PanelService, type ComponentEntry}
