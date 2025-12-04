const TIME_OUT_TIME = 500;

export class MouseTimer<Source> {
    private activeTimer: number;
    private source: Source;
    private mouseUpCount = 0;

    private readonly onClick: (source: Source) => void = undefined;
    private readonly onTimeOut: (source: Source) => void = undefined;
    private readonly onMultiClick: (source: Source, clickCount: number) => void = undefined;

    constructor(source: Source,
                onClick: (source: Source) => void = undefined,
                onMultiClick: (source: Source, clickCount: number) => void = undefined,
                onTimeOut: (source: Source) => void = undefined
    ) {
        this.source = source;
        this.onClick = onClick;
        this.onMultiClick = onMultiClick;
        this.onTimeOut = onTimeOut;
    }

    onMouseDown = (ev: MouseEvent) => {
        if(this.activeTimer)
            return;
        this.startPressTimer(ev, () => {
            this.doTimeOut();
        });
    };

    onMouseUp = (ev: MouseEvent) => {
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
        this.onTimeOut?.(this.source);
    }

    private cancelPressTimer() {
        if(this.activeTimer)
            clearTimeout(this.activeTimer);
        this.activeTimer = undefined;
    }

    private startPressTimer(ev: MouseEvent, onTimeOutCallback: (ev: MouseEvent) => void) {
        this.mouseUpCount = 0;
        this.activeTimer = setTimeout(() => {
            if(this.activeTimer)
                onTimeOutCallback(ev);
            this.cancelPressTimer();
        }, TIME_OUT_TIME);
    }

}