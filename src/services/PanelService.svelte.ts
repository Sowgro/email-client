import type {Component} from "svelte";

interface ComponentEntry<T extends Record<string, unknown> = Record<string, unknown>> {
    component: Component<T>;
    props: T;
}

class PanelService {
    public panels: ComponentEntry[] = $state([])

    public addPanel(entry: ComponentEntry) {
        this.panels = [...this.panels, entry]
    }
}

export default PanelService