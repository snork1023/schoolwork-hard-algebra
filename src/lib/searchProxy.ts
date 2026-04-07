export const SCRAMJET_PROXY_URL = "https://aluu.xyz/bare/";

export const SEARCH_PROXY_FUNCTION = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-proxy`
  : "/functions/v1/search-proxy";

export const SEARCH_ENGINES: Record<string, string> = {
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
  brave: "https://search.brave.com/search?q=",
};

export const DEFAULT_SEARCH_ENGINE = "duckduckgo";
