/*
    In this current example, I'm using Nomad to recursively explore
    my university website so I can find pages that I might not have
    otherwise found.
*/

console.log("loading modules...");

import { Nomad } from "./nomad/core";
import fs from "fs";
import chalk from "chalk";
import { Util } from "./nomad/util";

console.log("starting...");

export function prettyPrintNomadStatistics(stats: any) {
    console.log(
        [
            "====== Statistics ======",
            " visited pages:      " + chalk.magenta(stats.visitedPages),
            " visited domains:    " + chalk.magenta(stats.visitedDomains),
            " current nodes:      " + chalk.green(stats.nodes),
            " pending reqs:       " + chalk.yellow(stats.inProgress),
            " data usage:         " + chalk.blue(Util.sizeDescriptor(stats.storageSize)),
            " fetch success rate: " + chalk.green(((1 - stats.fetchFailRate) * 100).toFixed(1) + "%"),
            " avg. request time:  " + chalk.blue(Math.floor(stats.averageFetchTime) + "ms"),
            " pruned nodes:       " + chalk.red(stats.prunedNodes),
            " data processed:     " + chalk.blue(Util.sizeDescriptor(stats.bytesProcessed)),
            "========================",
        ].join("\n")
    );
}

let nomad = new Nomad({
    maxPendingRequests: 100,
    requestOverflowCooldown: 200,
    useDeepParser: true,
    hostnameRegex: /^.+\.utoronto\.ca$/,
});

nomad.onVisitNewDomain.addListener((domain) => {
    fs.appendFileSync("domains.txt", domain + "\n");
});

let last = Date.now();
nomad.onProcessNode.addListener((node) => {
    let stats = nomad.getStatistics();
    if (Date.now() - last > 1000) {
        process.stdout.write("\x1Bc");
        prettyPrintNomadStatistics(stats);
        last = Date.now();
    }
});

nomad.addNodes(
    "https://utoronto.ca",
    "https://q.utoronto.ca/",
    "https://studentlife.utoronto.ca/task/meet-with-your-registrar-academic-advisor/",
    "https://tcard.utoronto.ca/",
    "https://coursefinder.utoronto.ca/",
    "https://learningcommunities.utoronto.ca/",
    "https://web.cs.toronto.edu/"
);
nomad.run();
