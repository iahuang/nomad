console.log("loading modules...");
import chalk from "chalk";
import { Nomad } from "./nomad/core";
import { Util } from "./nomad/util";
import fs from "fs";
console.log("starting...");

let nomad = new Nomad({
    maxPendingRequests: 100,
    requestOverflowCooldown: 200,
    useDeepParser: true
});

nomad.onVisitNewDomain.addListener((domain) => {
    fs.appendFileSync("domains.txt", domain + "\n");
});

let last = Date.now();
nomad.onProcessNode.addListener((node) => {
    let stats = nomad.getStatistics();
    if (Date.now() - last > 1000) {
        process.stdout.write("\x1Bc");
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
        last = Date.now();
    }
});

nomad.addNodes("https://github.com/");
nomad.run();
