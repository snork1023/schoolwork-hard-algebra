import { useMemo } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useChime } from "./ChimeProvider";
import { Avatar } from "./Avatar";

export function IncomingCallToast() {
  const { state, currentUser, joinCall, declineCall } = useChime();

  const incoming = useMemo(() => {
    if (!currentUser) return [];
    return Object.values(state.calls).filter(
      (c) =>
        !c.participantIds.includes(currentUser.id) &&
        !state.dismissedCallIds.has(c.id)
    );
  }, [state.calls, state.dismissedCallIds, currentUser]);

  if (!currentUser || incoming.length === 0) return null;

  return (
    <div className="fixed right-6 top-20 z-50 flex flex-col gap-3">
      {incoming.map((call) => {
        const caller = state.users[call.initiatorId];
        const context =
          (call.channelId && state.channels[call.channelId]?.name) ||
          (call.chatId &&
            (state.chats[call.chatId]?.name ??
              (state.chats[call.chatId]?.kind === "dm" ? "you" : "a group"))) ||
          "you";
        return (
          <div
            key={call.id}
            className="flex items-center gap-3 rounded-2xl bg-card p-3 pr-2 shadow-glow ring-1 ring-border animate-fade-in"
          >
            {caller && <Avatar user={caller} size="md" />}
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Incoming {call.kind === "video" ? "video " : ""}call
              </div>
              <div className="truncate text-sm font-semibold text-foreground">
                {caller?.displayName ?? "Someone"} is calling {context}
              </div>
              <div className="text-xs text-muted-foreground">
                {call.participantIds.length} in call
              </div>
            </div>
            <button
              onClick={() => declineCall(call.id)}
              title="Decline"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border hover:bg-destructive/10 hover:text-destructive"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
            <button
              onClick={() => joinCall(call.id)}
              title="Join"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-white shadow-glow hover:bg-green-600 animate-pulse-blue"
            >
              {call.kind === "video" ? (
                <Video className="h-4 w-4" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
