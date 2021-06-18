/*
    A special object that works via the filesystem to store potentially
    large amounts of data in chunks. Non-persistent; i.e. cannot be used
    between sessions
*/

import fs from "fs";
import path from "path";
import { fnv_1a } from "./hash";
import { Util } from "./util";

const STORAGE_DIR = "_storage";
const N_STORAGE_BUCKETS = 512;

class Bucket {
    id: number;
    namespace: string;
    constructor(id: number, namespace: string) {
        this.id = id;
        this.namespace = namespace;
    }

    get filePath() {
        // Returns the underlying file path to the chunk data
        return path.join(STORAGE_DIR, this.namespace + "_chunk" + this.id);
    }

    makeFile() {
        fs.writeFileSync(this.filePath, "");
    }

    _formatDataEntry(data: string) {
        return Util.replaceAll(data, "\n", "\\n");
    }

    _load() {
        return fs.readFileSync(this.filePath, "utf-8").split("\n");
    }

    _rawAdd(data: string) {
        fs.appendFileSync(this.filePath, this._formatDataEntry(data) + "\n");
    }

    _has(data: string) {
        return this._load().includes(this._formatDataEntry(data));
    }
}

export class LargeHashSet {
    length: number;
    buckets: Bucket[];
    name: string;
    dataUsage: number; // in bytes

    static hasCleanedUp = false;

    constructor(name: string) {
        // init storage directory, if necessary
        if (!fs.existsSync(STORAGE_DIR)) {
            fs.mkdirSync(STORAGE_DIR);
        } else if (!LargeHashSet.hasCleanedUp) {
            // if the storage directory does exist, remove residual files
            // from last run
            LargeHashSet.cleanUp();
            fs.mkdirSync(STORAGE_DIR);
            LargeHashSet.hasCleanedUp = true;
        }

        this.length = 0;
        this.dataUsage = 0;
        this.buckets = [];
        this.name = name;

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
        this.dataUsage += (new TextEncoder().encode(data)).length;
        return true;
    }

    has(data: string) {
        return this._getBucketForData(data)._has(data);
    }

    static cleanUp() {
        fs.rmSync(STORAGE_DIR, { recursive: true });
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
