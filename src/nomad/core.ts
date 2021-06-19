import type { JSDOM } from "jsdom";
import { EventManager } from "./event_manager";
import { Fetcher } from "./fetcher";
import { LargeHashSet, LargeQueue } from "./session_storage";
import { getHref } from "./simple_parser";

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface NomadConfig {
    // maximum number of pending http requests that Nomad will allow at one time
    // if less than 2, Nomad will wait for each request to finish before moving to the next
    maxPendingRequests: number;

    // how long Nomad should wait for pending requests to finish (ms)
    requestOverflowCooldown: number;

    // Whether to use a proper HTML parser (jsdom) for parsing
    useDeepParser: boolean;
}

export class Nomad {
    fetcher: Fetcher;

    visitedPages: LargeHashSet;
    visitedDomains: LargeHashSet;

    nodes: LargeQueue;

    processingInProgress: number;

    onVisitPage = new EventManager<(page: string, pageHTML: string) => void>();
    onVisitNewDomain = new EventManager<(hostname: string) => void>();
    onProcessNode = new EventManager<(node: string) => void>();

    cfg: NomadConfig;

    // purely for statistics purposes
    numRequests: number;
    numNonOkRequests: number;
    numFailedRequests: number;
    timeSpentFetching: number; // in ms
    prunedNodes: number;
    bytesProcessed: number;

    _JSDOM: JSDOM | null;

    constructor(cfg: NomadConfig) {
        this.fetcher = new Fetcher();

        this.visitedPages = new LargeHashSet("visited_pages");
        this.visitedDomains = new LargeHashSet("visited_domains");

        this.nodes = new LargeQueue("node_queue");
        this.processingInProgress = 0;

        this.cfg = cfg;

        this.numRequests = 0;
        this.numNonOkRequests = 0;
        this.numFailedRequests = 0;
        this.timeSpentFetching = 0;
        this.prunedNodes = 0;
        this.bytesProcessed = 0;

        if (this.cfg.useDeepParser) console.log("Loading JSDOM...");
        this._JSDOM = cfg.useDeepParser ? (require("jsdom").JSDOM as JSDOM) : null;
    }

    addNodes(...nodes: string[]) {
        for (let node of nodes) {
            if (!this.validateNode(node)) {
                this.prunedNodes++;
                continue;
            }
            this.nodes.enqueue(node);
        }
    }

    getStatistics() {
        return {
            visitedPages: this.visitedPages.length,
            visitedDomains: this.visitedDomains.length,
            nodes: this.nodes.length,
            inProgress: this.processingInProgress,
            storageSize: this.visitedDomains.dataUsage + this.visitedPages.dataUsage + this.nodes.dataUsage,
            fetchFailRate: this.numFailedRequests / this.numRequests,
            averageFetchTime: this.timeSpentFetching / this.numRequests,
            prunedNodes: this.prunedNodes,
            bytesProcessed: this.bytesProcessed,
        };
    }

    // async waitForAllInProgress() {
    //     await new Promise((res, rej) => {
    //         this.resumeCallback = res;
    //     });
    // }

    async run() {
        if (this.cfg.maxPendingRequests > 1) {
            this._concurrentRun();
        } else {
            this._seriesRun();
        }
    }

    async _seriesRun() {
        while (this.nodes.length > 0) {
            await this.visitNode(this.nodes.dequeue());
        }
    }

    async _concurrentRun() {
        while (this.nodes.length > 0 || this.processingInProgress > 0) {
            // if there are too many pending requests, sit around for a bit to let
            // all the fetch calls catch up
            if (this.processingInProgress > this.cfg.maxPendingRequests) {
                await sleep(this.cfg.requestOverflowCooldown);
                continue;
            }
            if (this.nodes.length > 0) {
                let currNode = this.nodes.dequeue();

                this.visitNode(currNode);

                this.onProcessNode._notifyListeners(currNode);
            } else {
                console.log("Waiting for something to do...");
                await sleep(1000);
            }
        }
    }

    _parseURL(url: string) {
        let _url = new URL(url);
        _url.search = "";

        return {
            baseURL: _url.href,
            hostname: _url.hostname,
        };
    }

    validateNode(node: string) {
        if (!(node.startsWith("http://") || node.startsWith("https://"))) return false;
        let urlInfo = this._parseURL(node);
        if (this.visitedPages.has(urlInfo.baseURL)) return false;

        return true;
    }

    async visitNode(node: string) {
        if (!this.validateNode(node)) {
            this.prunedNodes += 1;
            return;
        }

        let urlInfo = this._parseURL(node);

        this.visitedPages.add(urlInfo.baseURL);
        let didAddNew = this.visitedDomains.add(urlInfo.hostname);

        // if we encountered a new domain, send an event notification
        if (didAddNew) this.onVisitNewDomain._notifyListeners(urlInfo.hostname);

        // query node
        this.processingInProgress += 1;

        try {
            this.numRequests += 1;

            let startTime = Date.now();
            let resp = await this.fetcher.httpGet(node);
            this.bytesProcessed += new TextEncoder().encode(resp.body).length;
            let deltaTime = Date.now() - startTime;

            this.timeSpentFetching += deltaTime;

            this.processingInProgress -= 1;

            if (resp.contentType.mimeType === "text/html") {
                this.onVisitPage._notifyListeners(urlInfo.baseURL, resp.body);
                this.processHTMLFile(resp.body, urlInfo.baseURL);
            }

            if (!resp.ok) {
                this.numNonOkRequests += 1;
            }
        } catch (err) {
            this.numFailedRequests += 1;
            this.processingInProgress -= 1;
            console.log(err);
        }

        // if (this.resumeCallback) {
        //     if (this.processingInProgress === 0) this.resumeCallback();
        // }
    }

    async processHTMLFile(htmlContent: string, parentURL: string) {
        let processRawURLS = (urls: string[]) => {
            let processed: string[] = [];
            for (let url of urls) {
                try {
                    // make sure links are non-relative
                    let absoluteURL = new URL(url, parentURL).href;
                    processed.push(absoluteURL);
                } catch {}
            }

            return processed;
        };

        if (this.cfg.useDeepParser) {
            let dom = new (this._JSDOM as any)(htmlContent);
            let document = dom.window.document;
            // add <a> href links
            let hrefs = Array.from(document.querySelectorAll("a")).map((n: any) => n.href);
            // add JS source files
            let srcs = Array.from(document.querySelectorAll("script")).map((n: any) => n.src);
            this.addNodes(...processRawURLS(hrefs));
            this.addNodes(...processRawURLS(srcs));
        } else {
            this.addNodes(...processRawURLS(getHref(htmlContent)));
        }
    }
}
