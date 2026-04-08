export const SCRAMJET_PROXY_URL = "/scram/service/";

export const SEARCH_ENGINES: Record<string, string> = {
  google: "https://www.google.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
  bing: "https://www.bing.com/search?q=",
};

export const buildProxiedSearchUrl = (query: string, engine: string): string => {
  const baseUrl = SEARCH_ENGINES[engine] || SEARCH_ENGINES.duckduckgo;
  const searchUrl = baseUrl + encodeURIComponent(query);
  return SCRAMJET_PROXY_URL + encodeURIComponent(searchUrl);
};
