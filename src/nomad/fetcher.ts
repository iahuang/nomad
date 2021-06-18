/*
    
*/

import fetch from "node-fetch";
import UserAgent from "user-agents";

function parseContentTypeHeader(ctype: string) {
    let parts = ctype.split("; ");
    let mime = parts[0];
    let args = parts.slice(1);

    let charset = "utf-8"; // default to "utf-8"

    for (let arg of args) {
        if (arg.startsWith("charset=")) {
            // remove the "charset=" from the string, and lowercase it for consistency
            charset = arg.substring("charset=".length).toLowerCase();
        }
    }

    return {
        mimeType: mime,
        charset: charset,
    };
}

export class Fetcher {
    userAgent: string;

    constructor() {
        this.userAgent = new UserAgent().toString();
    }

    async httpGet(url: string) {
        let response = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": this.userAgent,
            }
        });

        let text = await response.text();

        return {
            status: response.status,
            ok: response.ok,
            body: text,
            contentType: parseContentTypeHeader(response.headers.get("Content-Type")!),
        };
    }
}
