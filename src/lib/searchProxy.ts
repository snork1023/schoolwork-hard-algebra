export const SCRAMJET_PROXY_URL = "/scram/";

export const SEARCH_ENGINES: Record<string, string> = {
  google: "https://www.google.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
  bing: "https://www.bing.com/search?q=",
};

export const SEARCH_PROXY_FUNCTION = async (query: string, engine: string): Promise<string> => {
  const baseUrl = SEARCH_ENGINES[engine] || SEARCH_ENGINES.duckduckgo;
  const searchUrl = baseUrl + encodeURIComponent(query);
  return "/scram/" + encodeURIComponent(searchUrl);
};