const TIME_OUT_TIME = 500;

export class MouseTimer<Source> {
    private activeTimer: number | null;
    private readonly source: Source;
    private mouseUpCount = 0;
    private isMouseDown = false;

    private readonly onClick: ((source: Source) => void) | undefined = undefined;
    private readonly onTimeOut: ((source: Source) => void) | undefined = undefined;
    private readonly onMultiClick: ((source: Source, clickCount: number) => void) | undefined = undefined;

    constructor(source: Source,
                onClick: ((source: Source) => void) | undefined = undefined,
                onMultiClick: ((source: Source, clickCount: number) => void) | undefined = undefined,
                onTimeOut: ((source: Source) => void) | undefined = undefined
    ) {
        this.source = source;
        this.onClick = onClick;
        this.onMultiClick = onMultiClick;
        this.onTimeOut = onTimeOut;
    }

    onMouseDown = (ev: MouseEvent) => {
        this.isMouseDown = true;
        if(this.activeTimer)
            return;
        this.startPressTimer(ev, () => {
            this.doTimeOut();
        });
    };

    onMouseUp = (ev: MouseEvent) => {
        this.isMouseDown = false;
        if(!this.activeTimer)
            return;
        this.mouseUpCount++;
        if(this.mouseUpCount > 1) {
            this.onMultiClick?.(this.source, this.mouseUpCount);
            return;
        }
        this.onClick?.(this.source);
    };

    onMouseLeave = (ev: MouseEvent) => {
        this.cancelPressTimer();
    }

    doTimeOut() {
        this.cancelPressTimer();
        if(!this.isMouseDown)
            return;
        this.onTimeOut?.(this.source);
    }

    private cancelPressTimer() {
        if(this.activeTimer)
            clearTimeout(this.activeTimer);
        this.activeTimer = null;
    }

    private startPressTimer(ev: MouseEvent, onTimeOutCallback: (ev: MouseEvent) => void) {
        this.mouseUpCount = 0;
        this.activeTimer = window.setTimeout(() => { //use `window.` to avoid conflict with nodejs version of setTimeout.
            if(this.activeTimer)
                onTimeOutCallback(ev);
            this.cancelPressTimer();
        }, TIME_OUT_TIME);
    }

}