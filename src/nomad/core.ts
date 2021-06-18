import { JSDOM } from "jsdom";
import { EventManager } from "./event_manager";
import { Fetcher } from "./fetcher";
import { LargeHashSet } from "./session_storage";

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface NomadConfig {
    maxPendingRequests: number; // maximum number of pending http requests that Nomad will allow at one time
}

export class Nomad {
    fetcher: Fetcher;

    visitedPages: LargeHashSet;
    visitedDomains: LargeHashSet;

    nodes: string[];

    processingInProgress: number;

    onVisitPage = new EventManager<(page: string, pageHTML: string) => void>();
    onVisitNewDomain = new EventManager<(hostname: string) => void>();
    onProcessNode = new EventManager<(node: string) => void>();

    cfg: NomadConfig;

    resumeCallback: Function | null;

    constructor(cfg: NomadConfig) {
        this.fetcher = new Fetcher();

        this.visitedPages = new LargeHashSet("visited_pages");
        this.visitedDomains = new LargeHashSet("visited_domains");

        this.nodes = [];
        this.processingInProgress = 0;

        this.resumeCallback = null;

        this.cfg = cfg;
    }

    addNodes(...nodes: string[]) {
        this.nodes.push(...nodes);
    }

    getStatistics() {
        return {
            visitedPages: this.visitedPages.length,
            visitedDomains: this.visitedDomains.length,
            nodes: this.nodes.length,
            inProgress: this.processingInProgress,
            storageSize: this.visitedDomains.dataUsage + this.visitedPages.dataUsage,
        };
    }

    async waitForAllInProgress() {
        await new Promise((res, rej) => {
            this.resumeCallback = res;
        });
    }

    async run() {
        while (this.nodes.length > 0 || this.processingInProgress > 0) {
            // if there are too many pending requests, sit around for a bit to let
            // all the fetch calls catch up
            if (this.processingInProgress > this.cfg.maxPendingRequests) {
                await sleep(100);
                continue;
            }
            if (this.nodes.length > 0) {
                let currNode = this.nodes.pop()!;

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

    async visitNode(node: string) {
        if (node.startsWith("about:blank")) return;

        let urlInfo = this._parseURL(node);

        if (this.visitedPages.has(urlInfo.baseURL)) return;
        this.visitedPages.add(urlInfo.baseURL);
        let didAddNew = this.visitedDomains.add(urlInfo.hostname);

        // if we encountered a new domain, send an event notification
        if (didAddNew) this.onVisitNewDomain._notifyListeners(urlInfo.hostname);

        // query node
        this.processingInProgress += 1;
        try {
            let resp = await this.fetcher.httpGet(node);
            this.processingInProgress -= 1;

            if (resp.contentType.mimeType === "text/html") {
                this.onVisitPage._notifyListeners(urlInfo.baseURL, resp.body);
                this.processHTMLFile(resp.body, urlInfo.baseURL);
            }
        } catch {
            this.processingInProgress -= 1;
        }

        

        // if (this.resumeCallback) {
        //     if (this.processingInProgress === 0) this.resumeCallback();
        // }
    }

    async processHTMLFile(htmlContent: string, parentURL: string) {
        let dom = new JSDOM(htmlContent);
        let document = dom.window.document;

        // add <a> href links
        let hrefs = Array.from(document.querySelectorAll("a"))
            .map((n) => n.href)
            .map((url) => {
                // make sure links are non-relative
                return new URL(url, parentURL).href;
            });

        // add JS source files
        let srcs = Array.from(document.querySelectorAll("script"))
            .map((n) => n.src)
            .map((url) => {
                // make sure links are non-relative
                return new URL(url, parentURL).href;
            });

        this.addNodes(...hrefs);
        this.addNodes(...srcs);
    }
}
