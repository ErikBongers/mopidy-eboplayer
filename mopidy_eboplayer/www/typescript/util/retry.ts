export class Retry {
    private readonly minDelay: number;
    private readonly maxDelay: number;
    private currentDelay: number;
    private readonly action: () => void;

    constructor(minDelay: number, maxDelay: number, action: () => void) {
        this.minDelay = minDelay;
        this.maxDelay = maxDelay;
        this.currentDelay = minDelay;
        this.action = action;
    }

    reset() {
        this.currentDelay = this.minDelay;
    }

    //retries after the current delay time.
    //no loop!
    //increases delay time on each call.
    retry() {
        console.log("Start retry...");
        // We asynchronously process the reconnect because we don't want to start
        // emitting "reconnectionPending" events before we've finished handling the
        // "state:offline" event, which would lead to emitting the events to
        // listeners in the wrong order.
        setTimeout(() => {
            setTimeout(() => {
                console.log("Retrying...");
                this.action();
            }, this.currentDelay);
            this.currentDelay *= 2;
            if (this.currentDelay > this.maxDelay) {
                this.currentDelay = this.maxDelay;
            }
        }, 0);
    }

}