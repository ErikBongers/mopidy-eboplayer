export enum EboPlayerDataType {
    Volume,
    CurrentTrack,
    PlayState,
    StreamLines
}

export abstract class View {
    private children: View[] = [];
    abstract bind(): void;
    abstract getRequiredData(): EboPlayerDataType[];
    static getSubId(parentId: string, subId: string) {
        return document.getElementById(`${parentId}.${subId}`);
    }

    addChildren(...children: View[]) {
        this.children.push(...children);
    }

    getRequiredDataRecursive(): EboPlayerDataType[] {
        return [...this.getRequiredData(), ...this.children.map(child => child.getRequiredDataRecursive()).flat()];
    }

    bindRecursive() {
        this.children.forEach(child => child.bindRecursive());
        this.bind();
    }
}