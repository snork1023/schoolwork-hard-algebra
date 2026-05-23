import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useChime } from "./ChimeProvider";
import { ChimeAuthPanel } from "./ChimeAuthPanel";
import { ServerSidebar } from "./ServerSidebar";
import { UserPanel } from "./UserPanel";
import { ChannelList } from "./ChannelList";
import { HomeSidebar, type HomeView } from "./HomeSidebar";
import { ChatView } from "./ChatView";
import { FriendsView } from "./FriendsView";
import { MembersPanel } from "./MembersPanel";
import { CallOverlay } from "./CallOverlay";
import { IncomingCallToast } from "./IncomingCallToast";
import { ProfileModal } from "./ProfileModal";
import { AddServerModal } from "./AddServerModal";
import type { Channel, ID, Server } from "@/lib/chime/types";

type View =
  | { kind: "home"; home: HomeView }
  | { kind: "server"; serverId: ID; channelId?: ID };

export function ChimeShell() {
  const { currentUser, state, startCall } = useChime();
  const [view, setView] = useState<View>({ kind: "home", home: { kind: "friends" } });
  const [profileOpen, setProfileOpen] = useState(false);
  const [addServerOpen, setAddServerOpen] = useState(false);

  if (!state.ready) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!state.signedIn || !currentUser) {
    return <ChimeAuthPanel />;
  }

  const onSelectServer = (server: Server) => {
    const firstChannel = server.channelIds
      .map((id) => state.channels[id])
      .find((c) => c && c.kind === "text");
    setView({ kind: "server", serverId: server.id, channelId: firstChannel?.id });
  };

  const onSelectChannel = (channel: Channel) => {
    setView({ kind: "server", serverId: channel.serverId, channelId: channel.id });
  };

  const activeServer =
    view.kind === "server" ? state.servers[view.serverId] : undefined;
  const activeChannel =
    view.kind === "server" && view.channelId
      ? state.channels[view.channelId]
      : undefined;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <ServerSidebar
        activeView={view.kind}
        onSelectHome={() => setView({ kind: "home", home: { kind: "friends" } })}
        activeServerId={view.kind === "server" ? view.serverId : undefined}
        onSelectServer={onSelectServer}
        onOpenAddServer={() => setAddServerOpen(true)}
      />

      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 overflow-hidden">
          {view.kind === "home" ? (
            <>
              <div className="flex w-60 flex-col">
                <HomeSidebar
                  view={view.home}
                  onChangeView={(h) => setView({ kind: "home", home: h })}
                />
                <UserPanel onOpenSettings={() => setProfileOpen(true)} />
              </div>
              {view.home.kind === "friends" ? (
                <FriendsView
                  onOpenChat={(chatId) =>
                    setView({ kind: "home", home: { kind: "chat", chatId } })
                  }
                />
              ) : (
                <ChatRouter
                  chatId={view.home.chatId}
                  onStartCall={(kind) =>
                    startCall(
                      { chatId: view.home.kind === "chat" ? view.home.chatId : undefined },
                      kind
                    )
                  }
                />
              )}
              {view.home.kind === "chat" && (
                <ChatMembersPanel chatId={view.home.chatId} />
              )}
            </>
          ) : activeServer ? (
            <>
              <div className="flex w-60 flex-col">
                <ChannelList
                  server={activeServer}
                  activeChannelId={activeChannel?.id}
                  onSelectChannel={onSelectChannel}
                />
                <UserPanel onOpenSettings={() => setProfileOpen(true)} />
              </div>
              {activeChannel ? (
                <ChatView
                  target={{ kind: "channel", channel: activeChannel }}
                  onStartCall={(kind) =>
                    startCall({ channelId: activeChannel.id }, kind)
                  }
                />
              ) : (
                <EmptyChannel />
              )}
              <MembersPanel memberIds={activeServer.memberIds} />
            </>
          ) : (
            <EmptyServer onOpenAddServer={() => setAddServerOpen(true)} />
          )}
        </div>
      </div>

      <CallOverlay />
      <IncomingCallToast />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <AddServerModal
        open={addServerOpen}
        onClose={() => setAddServerOpen(false)}
        onCreated={(s) => onSelectServer(s)}
      />
    </div>
  );
}

function ChatRouter({
  chatId,
  onStartCall,
}: {
  chatId: ID;
  onStartCall: (kind: "voice" | "video") => void;
}) {
  const { state } = useChime();
  const chat = state.chats[chatId];
  if (!chat) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        This chat doesn't exist.
      </div>
    );
  }
  return <ChatView target={{ kind: "chat", chat }} onStartCall={onStartCall} />;
}

function ChatMembersPanel({ chatId }: { chatId: ID }) {
  const { state } = useChime();
  const chat = state.chats[chatId];
  if (!chat || chat.kind === "dm") return null;
  return <MembersPanel memberIds={chat.memberIds} title="Group Members" />;
}

function EmptyChannel() {
  return (
    <div className="flex flex-1 items-center justify-center bg-card text-muted-foreground">
      <p>Select a channel to start chatting.</p>
    </div>
  );
}

function EmptyServer({ onOpenAddServer }: { onOpenAddServer: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-card px-6 text-center">
      <h2 className="text-2xl font-bold text-foreground">No server selected</h2>
      <p className="mt-2 text-muted-foreground">
        Pick one from the left, or add a new one to get started.
      </p>
      <button
        onClick={onOpenAddServer}
        className="mt-5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:bg-primary/90"
      >
        Add a Server
      </button>
    </div>
  );
}
