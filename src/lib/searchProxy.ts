export const UV_PREFIX = "/uv/service/";

export function uvEncodeUrl(url: string): string {
  return btoa(
    url
      .split("")
      .map((char) => String.fromCharCode(char.charCodeAt(0) ^ 2))
      .join("")
  );
}

export function uvDecodeUrl(encoded: string): string {
  return atob(encoded)
    .split("")
    .map((char) => String.fromCharCode(char.charCodeAt(0) ^ 2))
    .join("");
}

export function buildProxiedUrl(url: string): string {
  return UV_PREFIX + uvEncodeUrl(url);
}

export function buildSearchUrl(query: string): string {
  const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web`;
  return buildProxiedUrl(ddgUrl);
}
