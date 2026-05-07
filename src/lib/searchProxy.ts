import { initScramjet, SCRAMJET_PREFIX } from "./scramjet";

export const PROXY_PREFIX = SCRAMJET_PREFIX;

function resolveSearchTarget(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Empty query");
  }

  const hasWhitespace = /\s/.test(trimmed);
  const isPotentialDomain = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/.test(trimmed);
  const hasExplicitScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);

  if (!hasWhitespace && (hasExplicitScheme || isPotentialDomain)) {
    try {
      return new URL(trimmed).toString();
    } catch {
      try {
        return new URL(`https://${trimmed}`).toString();
      } catch {
        // Not a URL
      }
    }
  }

  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}&ia=web`;
}

export async function buildProxiedUrl(url: string): Promise<string> {
  const controller = await initScramjet();
  return controller.encodeUrl(url);
}

export async function buildSearchUrl(query: string): Promise<string> {
  const target = resolveSearchTarget(query);
  return buildProxiedUrl(target);
}

export function buildSearchTarget(query: string): string {
  return resolveSearchTarget(query);
}

export async function decodeProxiedUrl(encoded: string): Promise<string> {
  const controller = await initScramjet();
  const normalized = encoded.startsWith(PROXY_PREFIX)
    ? `${window.location.origin}${encoded}`
    : encoded;
  return controller.decodeUrl(normalized);
}
