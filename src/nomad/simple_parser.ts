export function getHref(htmlContent: string) {
    let pattern = /(?<=href=")([^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})(?=")/g;

    return (htmlContent.match(pattern) || []) as string[];
}