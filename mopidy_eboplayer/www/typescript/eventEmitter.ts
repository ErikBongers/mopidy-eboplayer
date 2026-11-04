export type EventListenerCallback = any;

//todo: use this one instead?
// https://javascript.plainenglish.io/building-a-simple-event-emitter-in-javascript-f82f68c214ad
export class EventEmitter {
    listeners: EventListenerCallback[] = [];
    supervisors: EventListenerCallback[] = [];

    emit(eventName: string, ...data: any) { //todo: make data a generic type T?
        this.listeners.filter(({name}) => name === eventName)
            .forEach(({callback}) => {
                setTimeout(() => callback.call(this, ...data), 0);
            });
        this.supervisors.forEach(callback => {
            setTimeout(() => callback.call(this, eventName, ...data), 0);
        });
    }

    on(event: string, callback?: any) { //todo: make callback type more specific?
        this.listeners.push({name: event, callback});
    }

    supervise(callback: (event: string, data: any) => void) { //todo: make callback type more specific?
        this.supervisors.push(callback);
    }

    off(eventName: string, callback: any) {
        this.removeListener(eventName, callback);
    }

    destroy() {
        this.listeners.length = 0;
    }

    removeAllListeners(eventName?: string) {
        if (!eventName) {
            this.listeners.length = 0;
            return;
        }
        this.listeners = this.listeners.filter(listener => !(listener.name === eventName));
    }

    removeListener(eventName: string, callback: any) {
        this.listeners = this.listeners.filter(listener =>
            !(listener.name === eventName &&
                listener.callback === callback)
        );
    }
}