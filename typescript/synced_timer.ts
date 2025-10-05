import {ProgressTimer} from "./timer";
import {Mopidy} from "../mopidy_eboplayer/static/js/mopidy";

function delay_exponential (base: number | 'rand', growthFactor: number, attempts: number) {
    /* Calculate number of beats between syncs based on exponential function.
    The format is::

        base * growthFactor ^ (attempts - 1)

    If ``base`` is set to 'rand' then a random number between
    0 and 1 will be used as the base.
    Base must be greater than 0.
    */
    if (base === 'rand') {
        base = Math.random()
    }
    // console.log(base + ' * (Math.pow(' + growthFactor + ', (' + attempts + ' - 1)) = ' + base * (Math.pow(growthFactor, (attempts - 1))))
    return base * (Math.pow(growthFactor, (attempts - 1)))
}

enum SYNC_STATE {
    NOT_SYNCED=0,
    SYNCING= 1,
    SYNCED= 2
}

export class SyncedProgressTimer {
    _maxAttempts: number;
    _mopidy: Mopidy;
    syncState = SYNC_STATE.NOT_SYNCED;
    _isSyncScheduled = false;
    _scheduleID = null;
    _syncAttemptsRemaining: number ;
    _previousSyncPosition = null;
    _duration = null;
    _isConnected = false;
    positionNode: Text;
    durationNode: Text;
    private _progressTimer: ProgressTimer;
    private commands: Commands;

    constructor(maxAttempts: number, mopidy: Mopidy, commands: Commands) {
        this._maxAttempts = maxAttempts;
        this._mopidy = mopidy;
        this.commands = commands;
        this._syncAttemptsRemaining = this._maxAttempts;

        this.positionNode = document.createTextNode('');
        this.durationNode = document.createTextNode('');
        //todo
        // $('#songelapsed').empty().append(this.positionNode)
        // $('#songlength').empty().append(this.durationNode)

        this._progressTimer = new ProgressTimer( (position: number, duration: number) => {
            this.timerCallback(position, duration);
            }
        );

        //todo
        // this._mopidy.on('state:online', $.proxy(function () { this._isConnected = true }), this)
        // this._mopidy.on('state:offline', $.proxy(function () { this._isConnected = false }), this)
    }


    static format(milliseconds: number) {
        if (milliseconds === Infinity) {
            return '';
        } else if (milliseconds === 0) {
            return '0:00';
        }

        let seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        seconds = seconds % 60;

        let secondString = seconds < 10 ? '0' + seconds : seconds.toString();
        return minutes + ':' + secondString;
    }

    timerCallback(position: number, duration: number) {
        this._update(position);
        if (this._isSyncScheduled && this._isConnected) {
            this._doSync(position, duration)
        }
    }

    _update(position: number) {
        switch (this.syncState) {
            case SYNC_STATE.NOT_SYNCED:
                // Waiting for Mopidy to provide a target position.
                this.positionNode.nodeValue = '(wait)'
                break
            case SYNC_STATE.SYNCING:
                // Busy seeking to new target position.
                this.positionNode.nodeValue = '(sync)'
                break
            case SYNC_STATE.SYNCED:
                this._previousSyncPosition = position
                this.positionNode.nodeValue = SyncedProgressTimer.format(position)
                //todo: document.getElementById('trackslider').val(position).slider('refresh')
                break
        }
    }

    _scheduleSync(milliseconds: number) {
        // Use an anonymous callback to set a boolean value, which should be faster to
        // check in the timeout callback than doing another function call.
        clearTimeout(this._scheduleID)
        this._isSyncScheduled = false
        if (milliseconds >= 0) {
            this._scheduleID = setTimeout(() => {
                this._isSyncScheduled = true;
            }, milliseconds);
        }
    }

    _doSync(position: number, duration: number) {
        let ready = !(duration === Infinity && position === 0);  // Timer has been properly initialized.
        if (!ready) {
            // Don't try to sync if progress timer has not been initialized yet.
            return;
        }

        this._scheduleSync(-1); // Ensure that only one sync process is active at a time.

        let _this = this;
        _this.commands.core_playback_get_time_position().then(function (targetPosition) {
            if (_this.syncState === SYNC_STATE.NOT_SYNCED) {
                _this.syncState = SYNC_STATE.SYNCING;
            }
            if (Math.abs(targetPosition - position) <= 500) {
                // Less than 500ms == in sync.
                _this._syncAttemptsRemaining = Math.max(_this._syncAttemptsRemaining - 1, 0);
                if (_this._syncAttemptsRemaining < _this._maxAttempts - 1 && _this._previousSyncPosition !== targetPosition) {
                    // Need at least two consecutive syncs to know that Mopidy
                    // is progressing playback and we are in sync.
                    _this.syncState = SYNC_STATE.SYNCED;
                }
                _this._previousSyncPosition = targetPosition;
                // Step back exponentially while increasing number of callbacks.
                _this._scheduleSync(delay_exponential(0.25, 2, _this._maxAttempts - _this._syncAttemptsRemaining) * 1000);
            } else {
                // Drift is too large, re-sync with Mopidy.
                _this.syncState = SYNC_STATE.SYNCING;
                _this._syncAttemptsRemaining = _this._maxAttempts;
                _this._previousSyncPosition = null;
                _this._scheduleSync(1000);
                _this._progressTimer.set(targetPosition);
            }
        });
    }

    set(position: number, duration: number = undefined) {
        this.syncState = SYNC_STATE.NOT_SYNCED;
        this._syncAttemptsRemaining = this._maxAttempts;
        // Workaround for https://github.com/adamcik/media-progress-timer/issues/3
        // This causes the timer to die unexpectedly if the position exceeds
        // the duration slightly.
        if (this._duration && this._duration < position) {
            position = this._duration - 1
        }
        if (arguments.length === 1) {
            this._progressTimer.set(position)
        } else {
            this._duration = duration
            this._progressTimer.set(position, duration)
            this.durationNode.nodeValue = SyncedProgressTimer.format(duration)
        }

        this.updatePosition(position);
        //todo document.getElementById('trackslider').val(position).slider('refresh')

        return this
    }

    start() {
        this.syncState = SYNC_STATE.NOT_SYNCED
        this._scheduleSync(0)
        this._progressTimer.start()
        return this
    }

    stop() {
        this._progressTimer.stop()
        this._scheduleSync(-1)
        if (this.syncState !== SYNC_STATE.SYNCED && this._previousSyncPosition) {
            // Timer was busy trying to sync when it was stopped, fallback to displaying the last synced position on screen.
            this.positionNode.nodeValue = SyncedProgressTimer.format(this._previousSyncPosition)
        }
        return this
    }

    reset() {
        this.stop()
        this.set(0, Infinity)

        return this
    }

    updatePosition(position: number) {
        if (!(this._duration === Infinity && position === 0)) {
            this.positionNode.nodeValue = SyncedProgressTimer.format(position)
        } else {
            this.positionNode.nodeValue = ''
        }
    }
}