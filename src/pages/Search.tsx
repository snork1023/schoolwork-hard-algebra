import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useUserSettings } from "@/hooks/useUserSettings";
import { SEARCH_PROXY_FUNCTION } from "@/lib/searchProxy";

const Search = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useUserSettings();
  const [status, setStatus] = useState("Redirecting to private search...");

  useEffect(() => {
    const query = searchParams.get("q") || "";
    const engine = searchParams.get("engine") || "duckduckgo";

    if (!query.trim()) {
      setStatus("Search query missing.");
      toast({
        title: "Search failed",
        description: "No search query was provided.",
        variant: "destructive",
      });
      return;
    }

    const run = async () => {
      try {
        setStatus("Creating secure search proxy...");
        const response = await fetch(SEARCH_PROXY_FUNCTION, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, engine }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const backendMessage = errorData?.error || `${response.status} ${response.statusText}`;
          throw new Error(backendMessage);
        }

        const content = await response.text();
        const contentType = response.headers.get('content-type') || '';
        const proxiedUrl = response.headers.get('x-proxied-url') || '';

        // Create a blob URL with the HTML content
        const blob = new Blob([content], { type: contentType });
        const blobUrl = URL.createObjectURL(blob);

        navigate(`/browser?url=${encodeURIComponent(blobUrl)}&original=${encodeURIComponent(proxiedUrl)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Search redirect error:", error);
        setStatus(settings.developerMode ? message : "Unable to redirect to search.");
        toast({
          title: "Search failed",
          description: settings.developerMode ? message : "Unable to redirect to search.",
          variant: "destructive",
        });
      }
    };

    run();
  }, [navigate, searchParams, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="max-w-xl w-full rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <p className="text-lg font-medium">{status}</p>
      </div>
    </div>
  );
};

export default Search;
