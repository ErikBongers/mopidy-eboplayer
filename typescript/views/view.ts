export enum EboPlayerDataType {
    Volume,
    CurrentTrack,
    PlayState,
}

export abstract class View {
    abstract bind(): void;
    abstract getRequiredData(): EboPlayerDataType[];
}