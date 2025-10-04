// Helper function to provide a reference time in milliseconds.
let now = /* Sinon does not currently support faking `window.performance`
             (see https://github.com/sinonjs/sinon/issues/803).
             Changing this to only rely on `new Date().getTime()
             in the interim in order to allow testing of the
             progress timer from MMW.

             typeof window.performance !== 'undefined' &&
             typeof window.performance.now !== 'undefined' &&
             window.performance.now.bind(window.performance) || Date.now ||*/
    function () {
        return new Date().getTime();
    };

interface TimerOptions {
    // Your callback for updating UI state, required.
    callback: (position:number, duration: number) => void,
    // Target frame rate when using legacy setTimeout fallback, default: 30.
    fallbackTargetFrameRate: number,
    // Force legacy setTimeout fallback for testing, default: false.
    disableRequestAnimationFrame: boolean
}

type TimerCallback = (position:number, duration:number)=> void;

// Creates a new timer object, works with both 'new ProgressTimer(options)'
// and just 'ProgressTimer(options). Optionally the timer can also be
// called with only the callback instead of options.
export class ProgressTimer {
    callback: TimerCallback;
    // Target frame rate when using legacy setTimeout fallback, default: 30.
    fallbackTargetFrameRate = 30;
    // Force legacy setTimeout fallback for testing, default: false.
    disableRequestAnimationFrame = false;

    _updateId = null;
    _state = null;  // Gets initialized by the set() call.
    private readonly _schedule: (timestamp: number) => number;
    private readonly _cancel: any;

    constructor(options: TimerOptions | TimerCallback) {
        if (typeof options === 'function') {
            this.callback = options;
        } else {
            this.callback = options.callback;
            this.fallbackTargetFrameRate = options.fallbackTargetFrameRate;
            this.disableRequestAnimationFrame = options.disableRequestAnimationFrame;
        }

        this._updateId = null;
        this._state = null;  // Gets initialized by the set() call.

        let frameDuration = 1000 / this.fallbackTargetFrameRate;

        let useFallback = (
            typeof window.requestAnimationFrame === 'undefined' ||
            typeof window.cancelAnimationFrame === 'undefined' ||
            options['disableRequestAnimationFrame'] || false);

        // Make sure this works in _update.
        let update = this._update.bind(this);

        if (useFallback) {
            this._schedule = function (timestamp: number) {
                let timeout = Math.max(timestamp + frameDuration - now(), 0);
                return window.setTimeout(update, Math.floor(timeout));
            };
            this._cancel = window.clearTimeout.bind(window);
        } else {
            this._schedule = window.requestAnimationFrame.bind(window, update);
            this._cancel = window.cancelAnimationFrame.bind(window);
        }

        this.reset(); // Reuse reset code to ensure we start in the same state.
    }

// If called with one argument the previous duration is preserved. Note
// that the position can be changed while the timer is running.
    set(position: number, duration: number = undefined) {
        if (!duration) {
            // Fallback to previous duration, whatever that was.
            duration = this._state.duration;
        }

        // Round down and make sure zero and null are treated as inf.
        duration = Math.floor(Math.max(
            duration === null ? Infinity : duration || Infinity, 0));

        // Make sure '0 <= position <= duration' always holds.
        position = Math.floor(Math.min(Math.max(position || 0, 0), duration));

        this._state = {
            initialTimestamp: null,
            initialPosition: position,
            position: position,
            duration: duration
        };

        // Update right away if we don't have anything running.
        if (this._updateId === null) {
            // TODO: Consider wrapping this in a try/catch?
            this.callback(position, duration);
        }
        return this;
    };

// Start the timer if it is not already running.
    start() {
        if (this._updateId === null) {
            this._updateId = this._schedule(0);
        }
        return this;
    };

// Cancel the timer if it us currently tracking progress.
    stop() {
        if (this._updateId !== null) {
            this._cancel(this._updateId);

            // Ensure we correctly reset the initial position and timestamp.
            this.set(this._state.position, this._state.duration);
            this._updateId = null;  // Last step to avoid callback in set()
        }
        return this;
    };

// Marks the timer as stopped, sets position to zero and duration to inf.
    reset() {
        return this.stop().set(0, Infinity);
    };

// Calls the user callback with the current position/duration and then
// schedules the next update run via _schedule if we haven't finished.
    _update(timestamp: number) {
        let state = this._state;  // We refer a lot to state, this is shorter.

        // Make sure setTimeout has a timestamp and store first reference time.
        timestamp = timestamp || now();
        state.initialTimestamp = state.initialTimestamp || timestamp;

        // Recalculate position according to start location and reference.
        state.position = (
            state.initialPosition + timestamp - state.initialTimestamp);

        // Ensure callback gets an integer and that 'position <= duration'.
        let userPosisition = Math.min(
            Math.floor(state.position), state.duration);

        // TODO: Consider wrapping this in a try/catch?
        this.callback(userPosisition, state.duration);
        // Workaround for https://github.com/adamcik/media-progress-timer/issues/3
        // Mopidy <= 1.1.2 does not always return the correct track position as
        // track changes are being done, which can cause the timer to die unexpectedly.
        //if (state.position < state.duration) {
        this._updateId = this._schedule(timestamp);  // Schedule update.
        //} else {
        //    this._updateId = null;  // Unset since we didn't reschedule.
        //}
    }
}
