const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;
const MAXINT_32 = Math.pow(2, 32) - 1;

const enc = new TextEncoder();

export function fnv_1a(s: string) {
    let hash = FNV_OFFSET_BASIS;

    let bytes = enc.encode(s);

    for (let byte of bytes) {
        hash = hash ^ byte;
        // convert signed int to unsigned int
        if (hash < 0) {
            hash = MAXINT_32 + hash;
        }

        hash = (hash * FNV_PRIME) % MAXINT_32;
    }

    return hash;
}
