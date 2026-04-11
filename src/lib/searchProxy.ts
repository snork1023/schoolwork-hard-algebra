export const UV_PREFIX = "/uv/service/";

// XOR encode — matches Ultraviolet.codec.xor.encode used in uv.config.js
export function uvEncodeUrl(url: string): string {
  return encodeURIComponent(
    url
      .split("")
      .map((char) => String.fromCharCode(char.charCodeAt(0) ^ 2))
      .join("")
  );
}

export function buildProxiedUrl(url: string): string {
  return UV_PREFIX + uvEncodeUrl(url);
}

export function buildSearchUrl(query: string): string {
  const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web`;
  return buildProxiedUrl(ddgUrl);
}