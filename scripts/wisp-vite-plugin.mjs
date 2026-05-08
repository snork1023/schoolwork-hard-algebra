import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
logging.set_level(logging.ERROR);
export default function wispPlugin(options = {}) {
  const path = options.path || "/wisp/";
  return {
    name: "wisp-server",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.on("upgrade", (req, socket, head) => {
        try {
          const url = req.url || "";
          if (!url.startsWith(path)) return;
          wisp.routeRequest(req, socket, head);
        } catch (err) {
          console.error("[wisp] upgrade error:", err);
          try {
            socket.destroy();
          } catch {}
        }
      });
    },
  };
}
