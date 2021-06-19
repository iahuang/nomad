# nomad

Nomad is a small project I wrote to experiment with web crawlers; i.e. programs that explore the internet by recursively following all of the links on a given page.

This project was designed with an emphasis on being able to handle large amounts of data. Potentially large data structures such as the set of all pages visited are stored on the filesystem so that the web crawler is theoretically only limited by the host system's disk space, and not by memory limits.

For a usage example, see `src/main.js`

### *Sample Output with https://github.com as the starting node*
![sample](https://cdn.discordapp.com/attachments/642183847072759838/855666195302580234/unknown.png)

## Try at Home

Run `npm install` to install all the necessary dependencies. I recommend you use [TS-Node](https://www.npmjs.com/package/ts-node) to run this project: run `ts-node src/main.ts`.