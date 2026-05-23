import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  Hash,
  Volume2,
  Send,
  Smile,
  Phone,
  Video,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { useChannelMessages, useChime } from "./ChimeProvider";
import { Avatar } from "./Avatar";
import { LIMITS } from "@/lib/chime/sanitize";
import type { Channel, DirectChat, ID, Message, User } from "@/lib/chime/types";

const EMOJIS = ["👍", "❤️", "😂", "🎉", "🔥", "💜", "👀", "🙏"];

interface ChatTarget {
  kind: "channel" | "chat";
  channel?: Channel;
  chat?: DirectChat;
}

export function ChatView({
  target,
  onStartCall,
}: {
  target: ChatTarget;
  onStartCall: (kind: "voice" | "video") => void;
}) {
  const { state, currentUser, sendMessage, editMessage, deleteMessage, toggleReaction } =
    useChime();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<ID | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [reactingFor, setReactingFor] = useState<ID | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const channelId =
    target.kind === "channel" ? target.channel?.id : target.chat?.id;

  const messages = useChannelMessages(channelId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, channelId]);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  if (!currentUser || !channelId) return null;

  const isVoice = target.kind === "channel" && target.channel?.kind === "voice";
  const headerLabel = (() => {
    if (target.kind === "channel" && target.channel) return target.channel.name;
    if (target.kind === "chat" && target.chat) {
      if (target.chat.kind === "group") return target.chat.name ?? "Group";
      const otherId = target.chat.memberIds.find((id) => id !== currentUser.id);
      return otherId ? state.users[otherId]?.displayName ?? "Direct Message" : "DM";
    }
    return "";
  })();

  const HeaderIcon = (() => {
    if (target.kind === "channel" && target.channel?.kind === "voice") return Volume2;
    if (target.kind === "channel") return Hash;
    return Users;
  })();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const r = await sendMessage(channelId, draft);
    if (r.ok) {
      setDraft("");
      setError(null);
    } else {
      setError(r.error ?? "Could not send message.");
    }
  };

  const onSaveEdit = async (id: ID) => {
    if (!editDraft.trim()) return;
    const r = await editMessage(id, editDraft.trim());
    if (r.ok) {
      setEditingId(null);
    } else {
      setError(r.error ?? "Could not edit message.");
    }
  };

  const remaining = LIMITS.MESSAGE_MAX - draft.length;

  return (
    <div className="flex h-full flex-1 flex-col bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <HeaderIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">{headerLabel}</h2>
          {target.kind === "channel" && target.channel?.topic && (
            <span className="ml-2 hidden border-l border-border pl-2 text-sm text-muted-foreground md:inline">
              {target.channel.topic}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onStartCall("voice")}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Start voice call"
          >
            <Phone className="h-5 w-5" />
          </button>
          <button
            onClick={() => onStartCall("video")}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Start video call"
          >
            <Video className="h-5 w-5" />
          </button>
        </div>
      </header>

      {isVoice ? (
        <VoicePlaceholder onStart={() => onStartCall("voice")} />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="rounded-full bg-muted p-5">
                  <HeaderIcon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-foreground">
                  Welcome to #{headerLabel}
                </h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  This is the very beginning of your conversation. Say hi!
                </p>
              </div>
            ) : (
              messages.map((m, i) => {
                const prev = messages[i - 1];
                const grouped =
                  prev && prev.authorId === m.authorId && m.createdAt - prev.createdAt < 5 * 60_000;
                return (
                  <MessageRow
                    key={m.id}
                    message={m}
                    grouped={grouped}
                    isMine={m.authorId === currentUser.id}
                    author={state.users[m.authorId]}
                    onEdit={() => {
                      setEditingId(m.id);
                      setEditDraft(m.content);
                    }}
                    onDelete={() => deleteMessage(m.id)}
                    onReact={(emoji) => toggleReaction(m.id, emoji)}
                    editing={editingId === m.id}
                    editDraft={editDraft}
                    onEditDraftChange={setEditDraft}
                    onEditSubmit={() => onSaveEdit(m.id)}
                    onEditCancel={() => setEditingId(null)}
                    onOpenReactions={() =>
                      setReactingFor((id) => (id === m.id ? null : m.id))
                    }
                    reactionsOpen={reactingFor === m.id}
                    onCloseReactions={() => setReactingFor(null)}
                  />
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {error && (
            <div className="mx-3 mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive ring-1 ring-destructive/30">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="border-t border-border p-3">
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 ring-1 ring-border focus-within:ring-primary/50">
              <Smile className="h-5 w-5 text-muted-foreground" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, LIMITS.MESSAGE_MAX))}
                maxLength={LIMITS.MESSAGE_MAX}
                placeholder={`Message ${headerLabel}`}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {draft.length > LIMITS.MESSAGE_MAX * 0.8 && (
                <span className={clsx(
                  "text-xs tabular-nums",
                  remaining < 100 ? "text-destructive" : "text-muted-foreground"
                )}>
                  {remaining}
                </span>
              )}
              <button
                type="submit"
                disabled={!draft.trim()}
                className={clsx(
                  "rounded-full p-1.5 text-primary-foreground transition",
                  draft.trim() ? "bg-primary hover:bg-primary/90" : "bg-muted-foreground/30"
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function MessageRow({
  message,
  grouped,
  isMine,
  author,
  onEdit,
  onDelete,
  onReact,
  editing,
  editDraft,
  onEditDraftChange,
  onEditSubmit,
  onEditCancel,
  onOpenReactions,
  reactionsOpen,
  onCloseReactions,
}: {
  message: Message;
  grouped: boolean;
  isMine: boolean;
  author?: User;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  editing: boolean;
  editDraft: string;
  onEditDraftChange: (v: string) => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
  onOpenReactions: () => void;
  reactionsOpen: boolean;
  onCloseReactions: () => void;
}) {
  if (!author) return null;
  return (
    <div
      className={clsx(
        "group relative flex gap-3 rounded-lg px-2 py-1 hover:bg-muted/60",
        grouped ? "mt-0.5" : "mt-3"
      )}
    >
      <div className="w-10 shrink-0">
        {!grouped && <Avatar user={author} size="sm" />}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span
              className="text-sm font-semibold"
              style={{ color: author.avatarColor }}
            >
              {author.displayName}
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}
        {editing ? (
          <div className="mt-1 flex items-center gap-2 rounded-lg bg-card px-3 py-1.5 ring-1 ring-border">
            <input
              autoFocus
              value={editDraft}
              onChange={(e) => onEditDraftChange(e.target.value.slice(0, LIMITS.MESSAGE_MAX))}
              maxLength={LIMITS.MESSAGE_MAX}
              onKeyDown={(e) => {
                if (e.key === "Enter") onEditSubmit();
                if (e.key === "Escape") onEditCancel();
              }}
              className="flex-1 bg-transparent text-sm text-foreground outline-none"
            />
            <button
              onClick={onEditCancel}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={onEditSubmit}
              className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Save
            </button>
          </div>
        ) : (
          <p className="break-words text-sm text-foreground">
            {message.content}
            {message.editedAt && (
              <span className="ml-1 text-[10px] text-muted-foreground/70">(edited)</span>
            )}
          </p>
        )}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(message.reactions).map(([emoji, userIds]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs ring-1 ring-border hover:bg-accent/40"
              >
                <span>{emoji}</span>
                <span className="text-muted-foreground">{userIds.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={clsx(
          "absolute -top-3 right-2 flex items-center gap-0.5 rounded-lg bg-card px-1 py-0.5 opacity-0 shadow-md ring-1 ring-border transition group-hover:opacity-100"
        )}
      >
        <button
          onClick={onOpenReactions}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Add reaction"
        >
          <Smile className="h-3.5 w-3.5" />
        </button>
        {isMine && !editing && (
          <>
            <button
              onClick={onEdit}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {reactionsOpen && (
        <div className="absolute right-2 top-6 z-10 flex gap-1 rounded-lg bg-card p-1.5 shadow-md ring-1 ring-border">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => {
                onReact(e);
                onCloseReactions();
              }}
              className="rounded-md p-0.5 text-lg hover:bg-muted"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VoicePlaceholder({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-muted via-card to-muted text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow animate-pulse-blue">
        <Volume2 className="h-10 w-10" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-foreground">Voice channel</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Jump into the call to hang out, chat, and connect with everyone here.
      </p>
      <button
        onClick={onStart}
        className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:bg-primary/90"
      >
        Join voice
      </button>
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return isToday ? `Today at ${time}` : `${d.toLocaleDateString()} ${time}`;
}
