export const SCRAMJET_PROXY_URL = "/scram/";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
export const SEARCH_PROXY_URL = `${SUPABASE_URL}/functions/v1/search-proxy`;

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