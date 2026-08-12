export type SelectionState = boolean | 'partial';

export class Selection<T> {
    private selectedKeys: Set<string> = $state(new Set());

    constructor(private readonly getKey: (item: T) => string) {}

    public get active() {
        return this.selectedKeys.size > 0;
    }

    public has(item: T) {
        return this.selectedKeys.has(this.getKey(item));
    }

    public selected(items: T[]) {
        return items.filter((item) => this.has(item));
    }

    public all(items: T[]) {
        return Boolean(items.length) && items.every((item) => this.has(item));
    }

    public some(items: T[]) {
        return items.some((item) => this.has(item));
    }

    public state(items: T[]): SelectionState {
        if (this.all(items)) {
            return true;
        }
        return this.some(items) ? 'partial' : false;
    }

    public set(items: T[], checked: boolean) {
        const nextSelection = new Set(this.selectedKeys);
        for (const item of items) {
            const key = this.getKey(item);
            checked ? nextSelection.add(key) : nextSelection.delete(key);
        }
        this.selectedKeys = nextSelection;
    }

    public toggle(items: T[]) {
        this.set(items, !this.all(items));
    }

    public clear() {
        this.selectedKeys = new Set();
    }
}
