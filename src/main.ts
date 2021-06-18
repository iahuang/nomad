console.log("loading modules...");
import chalk from "chalk";
import { Nomad } from "./nomad/core";
import { Util } from "./nomad/util";
console.log("starting...");

let nomad = new Nomad({
    maxPendingRequests: 1,
});

nomad.onVisitNewDomain.addListener((domain) => {
    console.log("Visited", domain);
});

let i = 0;
nomad.onProcessNode.addListener((node) => {
    i += 1;
    let stats = nomad.getStatistics();
    if (i % 100 === 0) {
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
                " total http reqs:    " + chalk.magenta(stats.totalRequests),
                "========================",
            ].join("\n")
        );
    }
});

nomad.addNodes("https://www.reddit.com/");
nomad.run();
