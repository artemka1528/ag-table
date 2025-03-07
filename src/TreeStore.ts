export type TreeItem = {
    id: number | string;
    parent: number | string | null;
    label: string;
    [key: string]: any;
};

export class TreeStore {
    private items: TreeItem[];
    private initialItems: TreeItem[];
    private itemMap: Map<TreeItem['id'], TreeItem>;
    private childrenMap: Map<TreeItem['parent'] | 'null', TreeItem[]>;

    constructor(items: TreeItem[]) {
        this.items = [...items];
        this.initialItems = [JSON.parse(JSON.stringify(items))];
        this.itemMap = new Map();
        this.childrenMap = new Map();

        items.forEach((item) => {
            this.itemMap.set(item.id, item);
            const parentKey = item.parent ?? 'null';
            if (!this.childrenMap.has(parentKey)) {
                this.childrenMap.set(parentKey, []);
            }
            this.childrenMap.get(parentKey)!.push(item);
        });
    }

    getAll(): TreeItem[] {
        return [...this.items];
    }

    getInitialState(): TreeItem[] {
        return [...this.initialItems];
    }

    getItem(id: TreeItem['id']): TreeItem | undefined {
        return this.itemMap.get(id);
    }

    getChildren(id: TreeItem['id']): TreeItem[] {
        return [...(this.childrenMap.get(id) || [])];
    }

    getAllChildren(id: TreeItem['id']): TreeItem[] {
        const result: TreeItem[] = [];
        const queue = this.getChildren(id);

        while (queue.length) {
            const item = queue.shift()!;
            result.push(item);
            queue.push(...this.getChildren(item.id));
        }

        return result;
    }

    addItem(newItem: TreeItem): void {
        if (this.itemMap.has(newItem.id)) {
            throw new Error(`Item with id ${newItem.id} already exists`);
        }

        this.items.push(newItem);
        this.itemMap.set(newItem.id, newItem);

        const parentKey = newItem.parent ?? 'null';
        if (!this.childrenMap.has(parentKey)) {
            this.childrenMap.set(parentKey, []);
        }
        this.childrenMap.get(parentKey)!.push(newItem);
    }

    removeItem(id: TreeItem['id']): void {
        const idsToDelete = new Set([id]);
        const queue = this.getChildren(id);

        while (queue.length) {
            const item = queue.shift()!;
            idsToDelete.add(item.id);
            queue.push(...this.getChildren(item.id));
        }

        this.items = this.items.filter((item) => !idsToDelete.has(item.id));
        idsToDelete.forEach((id) => {
            this.itemMap.delete(id);
            this.childrenMap.delete(id);
        });

        this.childrenMap.forEach((children, parent) => {
            this.childrenMap.set(parent, children.filter(
                (child) => !idsToDelete.has(child.id)
            ));
        });
    }

    updateItem(updatedItem: TreeItem): void {
        const oldItem = this.itemMap.get(updatedItem.id);
        if (!oldItem) throw new Error("Item not found");

        if (oldItem.parent !== updatedItem.parent || oldItem.label !== updatedItem.label) {
            const oldParent = oldItem.parent ?? 'null';
            this.childrenMap.set(oldParent,
                this.childrenMap.get(oldParent)!.filter(
                    (item) => item.id !== updatedItem.id
                )
            );

            const newParent = updatedItem.parent ?? 'null';
            if (!this.childrenMap.has(newParent)) {
                this.childrenMap.set(newParent, []);
            }
            this.childrenMap.get(newParent)!.push(updatedItem);
        }

        Object.assign(oldItem, updatedItem);
    }

    updateItems(newItems: TreeItem[]): void {
        this.items = newItems.map(item => ({ ...item }));
        this.itemMap.clear();
        this.childrenMap.clear();

        newItems.forEach((item) => {
            this.itemMap.set(item.id, item);
            const parentKey = item.parent ?? 'null';
            if (!this.childrenMap.has(parentKey)) {
                this.childrenMap.set(parentKey, []);
            }
            this.childrenMap.get(parentKey)!.push(item);
        });
    }
}
