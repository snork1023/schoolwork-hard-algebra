import clsx from "clsx";
import { useState } from "react";
import { Users, MessageSquare, UserPlus, Check, X, UserMinus } from "lucide-react";
import { useChime } from "./ChimeProvider";
import { Avatar } from "./Avatar";
import type { ID, User } from "@/lib/chime/types";
import { LIMITS } from "@/lib/chime/sanitize";

type Tab = "all" | "online" | "pending" | "add";

export function FriendsView({
  onOpenChat,
}: {
  onOpenChat: (chatId: ID) => void;
}) {
  const {
    state,
    currentUser,
    sendFriendRequest,
    acceptFriend,
    removeFriend,
    openDM,
  } = useChime();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [addResult, setAddResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!currentUser) return null;

  const friendships = Object.values(state.friendships).filter((f) =>
    f.userIds.includes(currentUser.id)
  );

  const accepted = friendships.filter((f) => f.status === "accepted");
  const pending = friendships.filter((f) => f.status === "pending");

  const otherUser = (f: typeof friendships[number]) =>
    state.users[f.userIds.find((id) => id !== currentUser.id)!];

  const acceptedUsers = accepted
    .map((f) => ({ f, u: otherUser(f) }))
    .filter((x): x is { f: typeof accepted[number]; u: User } => Boolean(x.u));
  const onlineUsers = acceptedUsers.filter((x) => x.u.status === "online");

  const filter = (list: typeof acceptedUsers) =>
    search
      ? list.filter(
          (x) =>
            x.u.displayName.toLowerCase().includes(search.toLowerCase()) ||
            x.u.username.toLowerCase().includes(search.toLowerCase())
        )
      : list;

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddResult(null);
    const r = await sendFriendRequest(addQuery);
    if (r.ok) {
      setAddResult({ ok: true, msg: `Friend request sent to ${addQuery}!` });
      setAddQuery("");
    } else {
      setAddResult({ ok: false, msg: r.error ?? "Could not send request." });
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-card">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Friends</h2>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {(
            [
              ["all", `All — ${acceptedUsers.length}`],
              ["online", `Online — ${onlineUsers.length}`],
              ["pending", `Pending — ${pending.length}`],
              ["add", "Add Friend"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm transition",
                tab === key
                  ? key === "add"
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent/40 text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "add" ? (
          <div className="mx-auto max-w-xl">
            <h3 className="text-lg font-semibold text-foreground">Add Friend</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You can add a friend with their Chime username.
            </p>
            <form
              onSubmit={onAdd}
              className="mt-4 flex items-center gap-2 rounded-xl bg-muted p-2 ring-1 ring-border"
            >
              <input
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value.slice(0, LIMITS.USERNAME_MAX))}
                maxLength={LIMITS.USERNAME_MAX}
                placeholder="Enter a username"
                className="flex-1 rounded-lg bg-card px-3 py-2 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary/50"
              />
              <button
                type="submit"
                disabled={!addQuery.trim()}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted-foreground/40"
              >
                Send Friend Request
              </button>
            </form>
            {addResult && (
              <p
                className={clsx(
                  "mt-3 rounded-lg px-3 py-2 text-sm",
                  addResult.ok
                    ? "bg-green-500/10 text-green-500 ring-1 ring-green-500/30"
                    : "bg-destructive/10 text-destructive ring-1 ring-destructive/30"
                )}
              >
                {addResult.msg}
              </p>
            )}

            <div className="mt-8">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Suggestions
              </h4>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Other users on Chime you might know.
              </p>
              <div className="mt-3 space-y-2">
                {Object.values(state.users)
                  .filter((u) => u.id !== currentUser.id)
                  .filter(
                    (u) =>
                      !friendships.some(
                        (f) => f.userIds.includes(u.id) && f.userIds.includes(currentUser.id)
                      )
                  )
                  .slice(0, 6)
                  .map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border"
                    >
                      <Avatar user={u} size="sm" showStatus />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-foreground">
                          {u.displayName}
                        </div>
                        <div className="text-xs text-muted-foreground">@{u.username}</div>
                      </div>
                      <button
                        onClick={async () => {
                          const r = await sendFriendRequest(u.username);
                          if (!r.ok) {
                            setAddResult({ ok: false, msg: r.error ?? "Could not send request." });
                          } else {
                            setAddResult({ ok: true, msg: `Friend request sent to ${u.username}!` });
                          }
                        }}
                        className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground ring-1 ring-border hover:bg-accent/40"
                      >
                        <UserPlus className="h-3 w-3" /> Add
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value.slice(0, 64))}
              maxLength={64}
              placeholder="Search"
              className="mb-3 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            {tab === "all" &&
              filter(acceptedUsers).map(({ f, u }) => (
                <FriendRow
                  key={f.id}
                  user={u}
                  onMessage={async () => {
                    const chat = await openDM(u.id);
                    onOpenChat(chat.id);
                  }}
                  onRemove={() => removeFriend(f.id)}
                />
              ))}
            {tab === "online" &&
              filter(onlineUsers).map(({ f, u }) => (
                <FriendRow
                  key={f.id}
                  user={u}
                  onMessage={async () => {
                    const chat = await openDM(u.id);
                    onOpenChat(chat.id);
                  }}
                  onRemove={() => removeFriend(f.id)}
                />
              ))}
            {tab === "pending" &&
              pending.map((f) => {
                const u = otherUser(f);
                if (!u) return null;
                const incoming = f.initiatedBy !== currentUser.id;
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border"
                  >
                    <Avatar user={u} size="sm" showStatus />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">
                        {u.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        @{u.username} • {incoming ? "Incoming Friend Request" : "Outgoing Request"}
                      </div>
                    </div>
                    {incoming ? (
                      <>
                        <button
                          onClick={() => acceptFriend(f.id)}
                          className="rounded-full bg-green-500 p-2 text-white hover:bg-green-600"
                          title="Accept"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeFriend(f.id)}
                          className="rounded-full bg-destructive p-2 text-destructive-foreground hover:bg-destructive/80"
                          title="Decline"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => removeFriend(f.id)}
                        className="rounded-full bg-muted p-2 text-muted-foreground ring-1 ring-border hover:bg-accent/40"
                        title="Cancel request"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
          </>
        )}
      </div>
    </div>
  );
}

function FriendRow({
  user,
  onMessage,
  onRemove,
}: {
  user: User;
  onMessage: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <Avatar user={user} size="sm" showStatus />
      <div className="flex-1">
        <div className="text-sm font-semibold text-foreground">{user.displayName}</div>
        <div className="text-xs text-muted-foreground">
          @{user.username} • {user.status}
        </div>
      </div>
      <button
        onClick={onMessage}
        className="rounded-full bg-muted p-2 text-muted-foreground ring-1 ring-border hover:bg-accent/40 hover:text-foreground"
        title="Message"
      >
        <MessageSquare className="h-4 w-4" />
      </button>
      <button
        onClick={onRemove}
        className="rounded-full bg-muted p-2 text-muted-foreground opacity-0 ring-1 ring-border transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
        title="Remove friend"
      >
        <UserMinus className="h-4 w-4" />
      </button>
    </div>
  );
}
