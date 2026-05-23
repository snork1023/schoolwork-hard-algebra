import { Mic, MicOff, Headphones, VolumeX, Settings, LogOut } from "lucide-react";
import { Avatar } from "./Avatar";
import { useChime } from "./ChimeProvider";

export function UserPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { currentUser, signOut, state, toggleMute, toggleDeafen } = useChime();
  if (!currentUser) return null;

  return (
    <div className="flex items-center gap-2 border-t border-border bg-card/60 p-2">
      <button
        onClick={onOpenSettings}
        className="flex flex-1 items-center gap-2 rounded-lg p-1.5 text-left hover:bg-muted"
        title="My profile"
      >
        <Avatar user={currentUser} size="sm" showStatus />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">
            {currentUser.displayName}
          </div>
          <div className="truncate text-xs text-muted-foreground">@{currentUser.username}</div>
        </div>
      </button>
      <div className="flex items-center">
        <button
          onClick={toggleMute}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={state.controls.muted ? "Unmute" : "Mute"}
        >
          {state.controls.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          onClick={toggleDeafen}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={state.controls.deafened ? "Undeafen" : "Deafen"}
        >
          {state.controls.deafened ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Headphones className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={onOpenSettings}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          onClick={signOut}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
