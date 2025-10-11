import {NestedDataRequester} from "./dataRequester";

export enum EboPlayerDataType {
    Volume,
    CurrentTrack,
    PlayState,
    StreamLines
}

export abstract class View extends NestedDataRequester<View> {
    abstract bind(): void;
    static getSubId(parentId: string, subId: string) {
        return document.getElementById(`${parentId}.${subId}`);
    }

    bindRecursive() {
        this.children.forEach(child => child.bindRecursive());
        this.bind();
    }
}