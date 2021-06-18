export namespace Util {
    export function replaceAll(target: string, query: string, withString: string) {
        while (true) {
            let newString = target.replace(query, withString);

            if (newString !== target) {
                target = newString;
            } else {
                return newString;
            }
        }
    }

    export function sizeDescriptor(size: number) {
        const k = 1024;

        if (size >= k * k * k) {
            return (size / (k * k * k)).toFixed(1) + " GiB";
        }
        if (size >= k * k) {
            return (size / (k * k)).toFixed(1) + " MiB";
        }
        if (size >= k) {
            return (size / k).toFixed(1) + " KiB";
        }
        return size + " bytes";
    }

    export class ProgressBar {
        name: string;
        width: number; // in characters
        progress: number; // a float from 0-1

        constructor(name: string, width: number = 20) {
            this.name = name;
            this.width = width;
            this.progress = 0;
        }

        _print(data: string) {
            process.stdout.write(data);
        }

        _printProgressBar(initial: boolean) {
            if (!initial) {
                this._print("\x1B[F\x1B[2K");
            }

            let p = Math.ceil(this.progress * this.width);
            let bar = "[" + "=".repeat(p) + ".".repeat(this.width - p) + "]";

            console.log(this.name, bar, (this.progress * 100).toFixed(1) + "%");
        }

        display() {
            this._printProgressBar(true);
        }

        remove() {
            this._print("\x1B[F\x1B[2K");
        }

        setProgress(to: number) {
            this.progress = to;
            this._printProgressBar(false);
        }
    }
}
