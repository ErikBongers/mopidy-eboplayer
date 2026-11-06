export interface MessageBase {
    type: string;
}
export interface UpdateCache extends MessageBase {
    type: "updateCache";
    newVersion: string;
    oldVersion: string;
}

export interface AnotherMessage extends MessageBase {
    type: "anotherMessage";
    data: any;
}

export type ServiceWorkerMessage = UpdateCache | AnotherMessage;

