import {DBSchema, IDBPDatabase, openDB} from 'idb';
import {Repository} from "./repository";

const DB_VERSION = 1;
const DB_NAME = 'offlineCache';

export interface SocketReply {
    id: string;
    doc: unknown;
}

export interface LocalDb extends DBSchema {
    SocketReplies: {
        key: string;
        value: SocketReply;
        indexes: {};
    }
}

let cache: LocalCache | null = null;

export async function getOfflineDb() {
    if(!cache)
        cache = await LocalCache.get();
    return cache;
}


export class LocalCache {
    get SocketReplies(): Repository<LocalDb, "SocketReplies"> {
        return this._SocketReplies;
    }

    private readonly _SocketReplies: Repository<LocalDb, "SocketReplies">;

    constructor(private db: IDBPDatabase<LocalDb>) {
        this._SocketReplies = new Repository<LocalDb, "SocketReplies">(this.db, 'SocketReplies');
    }

    static async get() {
        return new LocalCache(await openDB<LocalDb>(DB_NAME, DB_VERSION, {
            async upgrade(db) {
                db.createObjectStore("SocketReplies", {keyPath: "id"});
            },
        }));
    }
}

export async function saveAndReturn<D, T extends Promise<D>>(id: string, doc: T): Promise<D> {
    let db = await getOfflineDb();
    let docX: D = await doc;
    await db.SocketReplies.put({id, doc: docX});
    return docX;
}