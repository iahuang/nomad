console.log("loading modules...");
import chalk from "chalk";
import { Nomad } from "./nomad/core";
import { Util } from "./nomad/util";
console.log("starting...");

let nomad = new Nomad({
    maxPendingRequests: 200,
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
                " visited pages:   " + chalk.magenta(stats.visitedPages),
                " visited domains: " + chalk.magenta(stats.visitedDomains),
                " current nodes:   " + chalk.green(stats.nodes),
                " pending reqs:    " + chalk.yellow(stats.inProgress),
                " data usage:      " + chalk.blue(Util.sizeDescriptor(stats.storageSize)),
                "========================",
            ].join("\n")
        );
    }
});

nomad.addNodes("https://docs.microsoft.com/en-us/windows/wsl/compare-versions");
nomad.run();
