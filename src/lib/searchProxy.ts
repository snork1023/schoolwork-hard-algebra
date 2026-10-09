import { initScramjet, SCRAMJET_PREFIX } from "./scramjet";

export const PROXY_PREFIX = SCRAMJET_PREFIX;

function resolveSearchTarget(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return "https://duckduckgo.com/?q=&ia=web";
  }

  const hasExplicitScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  if (hasExplicitScheme) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Invalid link. Only HTTP and HTTPS links are supported.");
      }
      return url.toString();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Invalid link.")) {
        throw error;
      }
      throw new Error("Invalid link. Check the URL and try again.");
    }
  }

  const hasWhitespace = /\s/.test(trimmed);
  const isPotentialDomain = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/.test(trimmed);

  if (!hasWhitespace && isPotentialDomain) {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      throw new Error("Invalid link. Check the URL and try again.");
    }
  }

  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}&ia=web`;
}

export function buildSearchTarget(query: string): string {
  return resolveSearchTarget(query);
}

export async function decodeProxiedUrl(encoded: string): Promise<string> {
  const controller = await initScramjet();
  const proxiedUrl = new URL(encoded, window.location.origin);
  const frame = controller.frames.find((candidate) =>
    proxiedUrl.pathname.startsWith(
      new URL(candidate.prefix, window.location.origin).pathname,
    )
  );

  if (frame) {
    const framePrefix = new URL(
      frame.prefix,
      window.location.origin,
    ).pathname;
    return controller.config.codec.decode(
      proxiedUrl.pathname.slice(framePrefix.length),
    );
  }

  const controllerPrefix = new URL(
    controller.prefix,
    window.location.origin,
  ).pathname;
  if (!proxiedUrl.pathname.startsWith(controllerPrefix)) return encoded;

  // Keep decoding links created by older versions, which used the shared prefix.
  return controller.config.codec.decode(
    proxiedUrl.pathname.slice(controllerPrefix.length),
  );
}
