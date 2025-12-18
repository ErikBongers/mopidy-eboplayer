export class Batching {
    constructor(private task: () => void) {
    }
    private requested = false;

    async schedule() {
        if(!this.requested) {
            this.requested = true;
            // noinspection ES6RedundantAwait
            this.requested = await false;
            this.execute();
        }
    }

    private execute() {
        this.task();
    }
}
