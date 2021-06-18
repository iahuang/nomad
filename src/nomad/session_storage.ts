/*
    A collection of special objects that work via the filesystem to store
    potentially large amounts of data in chunks. Non-persistent; i.e. cannot be used
    between sessions.

    Currently included are two implementations of the HashSet and Queue data structures,
    written specifically to make use of the filesystem rather than storing data in memory.
*/

import fs from "fs";
import path from "path";
import { fnv_1a } from "./hash";
import { Util } from "./util";

function _formatDataEntry(data: string) {
    return Util.replaceAll(data, "\n", "\\n");
}

function _unFormatDataEntry(data: string) {
    return Util.replaceAll(data, "\\n", "\n");
}

const STORAGE_DIR = "_storage";
const N_STORAGE_BUCKETS = 512;

export class LargeStorage {
    static hasCleanedUp = false;

    static init() {
        // init storage directory, if necessary
        if (!fs.existsSync(STORAGE_DIR)) {
            fs.mkdirSync(STORAGE_DIR);
        } else if (!LargeStorage.hasCleanedUp) {
            // if the storage directory does exist, remove residual files
            // from last run
            LargeStorage.cleanUp();
            fs.mkdirSync(STORAGE_DIR);
            LargeStorage.hasCleanedUp = true;
        }
    }

    static cleanUp() {
        fs.rmSync(STORAGE_DIR, { recursive: true });
    }
}

class Bucket {
    id: number;
    namespace: string;
    constructor(id: number, namespace: string) {
        this.id = id;
        this.namespace = namespace;
    }

    get filePath() {
        // Returns the underlying file path to the chunk data
        return path.join(STORAGE_DIR, this.namespace + "_bk_" + this.id.toString(16));
    }

    makeFile() {
        fs.writeFileSync(this.filePath, "");
    }

    _load() {
        return fs.readFileSync(this.filePath, "utf-8").split("\n");
    }

    _rawAdd(data: string) {
        fs.appendFileSync(this.filePath, _formatDataEntry(data) + "\n");
    }

    _has(data: string) {
        return this._load().includes(_formatDataEntry(data));
    }
}

export class LargeHashSet {
    length: number;
    buckets: Bucket[];
    name: string;
    dataUsage: number; // in bytes

    constructor(name: string) {
        this.length = 0;
        this.dataUsage = 0;
        this.buckets = [];
        this.name = name;

        LargeStorage.init();

        let progressBar = new Util.ProgressBar("building storage: " + this.name);
        progressBar.display();

        for (let i = 0; i < N_STORAGE_BUCKETS; i++) {
            let b = new Bucket(i, this.name);
            b.makeFile();
            this.buckets.push(b);
            progressBar.setProgress(i / (N_STORAGE_BUCKETS - 1));
        }
        progressBar.remove();
    }

    _getBucketIdForData(data: string) {
        return fnv_1a(data) % N_STORAGE_BUCKETS;
    }

    _getBucketForData(data: string) {
        return this.buckets[this._getBucketIdForData(data)];
    }

    add(data: string) {
        /* Returns true if there wasn't already the given item in the set */
        if (this.has(data)) return false;
        this._getBucketForData(data)._rawAdd(data);
        this.length++;
        this.dataUsage += new TextEncoder().encode(data).length;
        return true;
    }

    has(data: string) {
        return this._getBucketForData(data)._has(data);
    }
}

function test() {
    let store = new LargeHashSet("test");

    let lastTime = Date.now();

    for (let i = 0; i < Math.pow(10, 6); i++) {
        store.add(Math.random().toString());

        if (i % 1000 === 0 && i !== 0) {
            console.log(i);
            let thisTime = Date.now();
            let deltaTime = (thisTime - lastTime) / 1000;
            let timePerAdd = deltaTime / 1000;

            console.log(`current speed: ${1 / timePerAdd} adds/sec`);

            lastTime = thisTime;
        }
    }
}

const QUEUE_CHUNK_SIZE = 1024;

class QueueChunk {
    id: number;
    namespace: string;
    length: number;

    constructor(id: number, namespace: string) {
        this.id = id;
        this.namespace = namespace;
        this.length = 0;

        this._makeFile();
    }

    get filePath() {
        // Returns the underlying file path to the chunk data
        return path.join(STORAGE_DIR, this.namespace + "_chunk_" + this.id.toString(16));
    }

    _makeFile() {
        fs.writeFileSync(this.filePath, "");
    }

    _deleteFile() {
        fs.rmSync(this.filePath)
    }

    add(data: string) {
        fs.appendFileSync(this.filePath, _formatDataEntry(data) + "\n");
        this.length += 1;
    }

    dequeue() {
        let lines = fs.readFileSync(this.filePath, "utf-8").split("\n");

        let dequeued = lines[0];
        lines = lines.slice(1);

        fs.writeFileSync(this.filePath, lines.join("\n"));
        this.length -= 1;
        return _unFormatDataEntry(dequeued);
    }
}

export class LargeQueue {
    name: string;
    chunks: QueueChunk[];
    nextID: number;

    length: number;
    dataUsage: number;

    constructor(name: string) {
        this.name = name;
        this.nextID = 0;
        this.length = 0;
        this.dataUsage = 0;

        LargeStorage.init();

        this.chunks = [];
        this._addChunk();
    }

    enqueue(data: string) {
        let chunk = this._lastChunk();
        if (chunk.length === QUEUE_CHUNK_SIZE) {
            chunk = this._addChunk();
        }

        chunk.add(data);

        this.length += 1;
        this.dataUsage += new TextEncoder().encode(data).length;
    }

    dequeue() {
        let chunk = this._firstChunk();
        let dequeued = chunk.dequeue();

        if (chunk.length === 0) {
            // remove chunk
            this.chunks = this.chunks.slice(1);
            chunk._deleteFile();
        }

        if (this.chunks.length === 0) {
            this._addChunk();
        }


        this.length -= 1;
        this.dataUsage -= new TextEncoder().encode(dequeued).length;

        return dequeued;
    }

    _firstChunk() {
        return this.chunks[0];
    }

    _lastChunk() {
        return this.chunks[this.chunks.length - 1];
    }

    _addChunk() {
        let chunk = new QueueChunk(this.nextID, this.name);
        this.chunks.push(chunk);
        this.nextID++;
        return chunk;
    }
}
