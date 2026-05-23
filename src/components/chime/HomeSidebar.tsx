import clsx from "clsx";
import { useState } from "react";
import { Users, MessageSquarePlus, Search } from "lucide-react";
import { useChime } from "./ChimeProvider";
import type { DirectChat, ID, User } from "@/lib/chime/types";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import { LIMITS } from "@/lib/chime/sanitize";

export type HomeView =
  | { kind: "friends" }
  | { kind: "chat"; chatId: ID };

export function HomeSidebar({
  view,
  onChangeView,
}: {
  view: HomeView;
  onChangeView: (v: HomeView) => void;
}) {
  const { state, currentUser, createGroup } = useChime();
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<ID[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  if (!currentUser) return null;

  const myChats = Object.values(state.chats)
    .filter((c) => c.memberIds.includes(currentUser.id))
    .sort((a, b) => b.createdAt - a.createdAt);

  const friendIds = Object.values(state.friendships)
    .filter((f) => f.status === "accepted" && f.userIds.includes(currentUser.id))
    .map((f) => f.userIds.find((id) => id !== currentUser.id)!)
    .filter(Boolean);

  const friends = friendIds.map((id) => state.users[id]).filter(Boolean) as User[];

  const filteredChats = query
    ? myChats.filter((c) => labelForChat(c, state.users, currentUser.id).toLowerCase().includes(query.toLowerCase()))
    : myChats;

  const handleCreate = async () => {
    setError(null);
    try {
      const c = await createGroup(selectedFriendIds, groupName || "New Group");
      if (c) {
        setShowCreate(false);
        setGroupName("");
        setSelectedFriendIds([]);
        onChangeView({ kind: "chat", chatId: c.id });
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not create group.");
    }
  };

  return (
    <div className="flex h-full w-60 flex-col border-r border-border bg-card/60">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 64))}
            maxLength={64}
            placeholder="Find a conversation"
            className="w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="p-2">
        <button
          onClick={() => onChangeView({ kind: "friends" })}
          className={clsx(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
            view.kind === "friends"
              ? "bg-accent/40 text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Users className="h-4 w-4" /> Friends
        </button>
      </div>

      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Direct Messages
        </span>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Create group"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filteredChats.map((chat) => (
          <ChatRow
            key={chat.id}
            chat={chat}
            active={view.kind === "chat" && view.chatId === chat.id}
            onSelect={() => onChangeView({ kind: "chat", chatId: chat.id })}
          />
        ))}
        {filteredChats.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground/70">
            No chats yet. Open a friend's profile to start one.
          </p>
        )}
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create a Group"
        footer={
          <>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              disabled={selectedFriendIds.length === 0}
              onClick={handleCreate}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-glow hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              Create Group
            </button>
          </>
        }
      >
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value.slice(0, LIMITS.GROUP_NAME_MAX))}
          maxLength={LIMITS.GROUP_NAME_MAX}
          placeholder="Group name"
          className="mb-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Add friends
        </p>
        <div className="max-h-72 overflow-y-auto rounded-lg ring-1 ring-border">
          {friends.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              You don't have any friends yet — add some first!
            </p>
          )}
          {friends.map((f) => {
            const selected = selectedFriendIds.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() =>
                  setSelectedFriendIds((s) =>
                    s.includes(f.id) ? s.filter((id) => id !== f.id) : [...s, f.id]
                  )
                }
                className={clsx(
                  "flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-b-0",
                  selected ? "bg-muted" : "hover:bg-muted"
                )}
              >
                <Avatar user={f} size="sm" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{f.displayName}</div>
                  <div className="text-xs text-muted-foreground">@{f.username}</div>
                </div>
                <input type="checkbox" readOnly checked={selected} className="accent-primary" />
              </button>
            );
          })}
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/30">
            {error}
          </p>
        )}
      </Modal>
    </div>
  );
}

function labelForChat(chat: DirectChat, users: Record<ID, User>, meId: ID): string {
  if (chat.kind === "group") return chat.name || "Group Chat";
  const otherId = chat.memberIds.find((id) => id !== meId);
  return otherId ? users[otherId]?.displayName ?? "Unknown" : "Direct Message";
}

function ChatRow({
  chat,
  active,
  onSelect,
}: {
  chat: DirectChat;
  active: boolean;
  onSelect: () => void;
}) {
  const { state, currentUser } = useChime();
  if (!currentUser) return null;
  const label = labelForChat(chat, state.users, currentUser.id);
  const other = chat.kind === "dm" ? state.users[chat.memberIds.find((id) => id !== currentUser.id)!] : null;

  return (
    <button
      onClick={onSelect}
      className={clsx(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition",
        active ? "bg-accent/40" : "hover:bg-muted"
      )}
    >
      {chat.kind === "dm" && other ? (
        <Avatar user={other} size="sm" showStatus />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {label.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{label}</div>
        <div className="truncate text-xs text-muted-foreground">
          {chat.kind === "group" ? `${chat.memberIds.length} members` : other?.status ?? ""}
        </div>
      </div>
    </button>
  );
}
