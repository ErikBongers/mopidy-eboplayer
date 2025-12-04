export class MouseTimer<Source> {
    private stillPressing: boolean;
    private timer: number;
    private source: Source;

    private readonly onClick: (source: Source) => void = undefined;
    private readonly onTimeOut: (source: Source) => void = undefined;
    private onMultiClick: (source: Source, clickCount: number) => void = undefined;

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
        this.startPressTimer(ev, () => {
            this.doTimeOut();
        });
    };

    onMouseUp = (ev: MouseEvent) => {
        if(this.stillPressing)
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
        this.stillPressing = false;
        if(this.timer)
            clearTimeout(this.timer);
        this.timer = undefined;
    }

    private startPressTimer(ev: MouseEvent, onLongPressedCallback: (ev: MouseEvent) => void) {
        this.stillPressing = true;
        this.timer = setTimeout(() => {
            if(this.stillPressing)
                onLongPressedCallback(ev);
            this.cancelPressTimer();
        }, 500);
    }

}