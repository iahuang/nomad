export class EventManager<T extends Function> {
    listeners: T[];

    constructor() {
        this.listeners = [];
    }

    addListener(cb: T) {
        this.listeners.push(cb);
    }

    _notifyListeners(...args: unknown[]) {
        for (let listener of this.listeners) {
            listener(...args);
        }
    }
}

