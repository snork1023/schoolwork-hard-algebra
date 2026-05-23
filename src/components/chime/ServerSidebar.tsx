import { Home, Plus, Compass } from "lucide-react";
import clsx from "clsx";
import { useChime } from "./ChimeProvider";
import type { Server } from "@/lib/chime/types";

export function ServerSidebar({
  activeView,
  onSelectHome,
  activeServerId,
  onSelectServer,
  onOpenAddServer,
}: {
  activeView: "home" | "server";
  onSelectHome: () => void;
  activeServerId?: string;
  onSelectServer: (server: Server) => void;
  onOpenAddServer: () => void;
}) {
  const { state, currentUser } = useChime();
  const myServers = Object.values(state.servers).filter((s) =>
    currentUser ? s.memberIds.includes(currentUser.id) : false
  );

  return (
    <aside className="flex w-[76px] flex-col items-center gap-2 border-r border-border bg-card/60 py-3">
      <button
        onClick={onSelectHome}
        className={clsx(
          "group relative flex h-12 w-12 items-center justify-center text-primary-foreground shadow-glow transition-all duration-200",
          activeView === "home"
            ? "rounded-2xl bg-gradient-to-br from-primary to-accent"
            : "rounded-3xl bg-gradient-to-br from-primary/80 to-accent/80 hover:rounded-2xl hover:from-primary hover:to-accent"
        )}
        title="Home"
      >
        <Home className="h-5 w-5" />
        <span
          className={clsx(
            "absolute -left-2 w-1 rounded-r-full bg-primary transition-all",
            activeView === "home" ? "h-9" : "h-0 group-hover:h-5"
          )}
        />
      </button>

      <div className="my-1 h-px w-8 rounded bg-border" />

      <div className="flex flex-col items-center gap-2 overflow-y-auto px-1">
        {myServers.map((s) => {
          const active = activeView === "server" && activeServerId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelectServer(s)}
              className={clsx(
                "group relative flex h-12 w-12 items-center justify-center overflow-hidden text-xl text-white shadow-sm transition-all duration-200",
                active ? "rounded-2xl ring-2 ring-primary ring-offset-2 ring-offset-card" : "rounded-3xl hover:rounded-2xl"
              )}
              style={s.iconUrl ? undefined : { backgroundColor: s.iconColor }}
              title={s.name}
            >
              {s.iconUrl ? (
                <img src={s.iconUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden>{s.iconEmoji}</span>
              )}
              <span
                className={clsx(
                  "absolute -left-2 w-1 rounded-r-full bg-primary transition-all",
                  active ? "h-9" : "h-0 group-hover:h-5"
                )}
              />
            </button>
          );
        })}
      </div>

      <button
        onClick={onOpenAddServer}
        className="mt-1 flex h-12 w-12 items-center justify-center rounded-3xl bg-muted text-primary transition-all duration-200 hover:rounded-2xl hover:bg-accent/40"
        title="Add a Server"
      >
        <Plus className="h-5 w-5" />
      </button>
      <button
        onClick={onOpenAddServer}
        className="flex h-12 w-12 items-center justify-center rounded-3xl bg-muted text-primary transition-all duration-200 hover:rounded-2xl hover:bg-accent/40"
        title="Explore"
      >
        <Compass className="h-5 w-5" />
      </button>
    </aside>
  );
}
