export enum EboPlayerDataType {
    Volume,
    CurrentTrack
}

export abstract class View {
    abstract bind(): void;
    abstract getRequiredData(): EboPlayerDataType[];
}