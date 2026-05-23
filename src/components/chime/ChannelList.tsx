import clsx from "clsx";
import { Hash, Volume2, Plus, Trash2, Copy, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { Channel, Server } from "@/lib/chime/types";
import { useChime } from "./ChimeProvider";
import { Modal } from "./Modal";
import { LIMITS } from "@/lib/chime/sanitize";

export function ChannelList({
  server,
  activeChannelId,
  onSelectChannel,
}: {
  server: Server;
  activeChannelId?: string;
  onSelectChannel: (channel: Channel) => void;
}) {
  const { state, createChannel, deleteChannel, currentUser, leaveServer } = useChime();
  const channels = server.channelIds
    .map((id) => state.channels[id])
    .filter((c): c is Channel => Boolean(c));
  const textChannels = channels.filter((c) => c.kind === "text");
  const voiceChannels = channels.filter((c) => c.kind === "voice");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<Channel["kind"]>("text");
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOwner = currentUser?.id === server.ownerId;

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const c = await createChannel(server.id, newName.trim(), newKind);
      if (c) {
        setNewName("");
        setShowCreate(false);
        onSelectChannel(c);
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not create channel.");
    }
  };

  return (
    <div className="flex h-full w-60 flex-col border-r border-border bg-card/60">
      <button
        onClick={() => setShowInvite(true)}
        className="group flex items-center justify-between border-b border-border px-4 py-3 hover:bg-muted"
      >
        <div className="flex items-center gap-2">
          {server.iconUrl ? (
            <img
              src={server.iconUrl}
              alt=""
              className="h-7 w-7 rounded-lg object-cover ring-1 ring-border"
            />
          ) : (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-sm text-white"
              style={{ backgroundColor: server.iconColor }}
            >
              {server.iconEmoji}
            </span>
          )}
          <span className="font-semibold text-foreground truncate">{server.name}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex-1 overflow-y-auto p-2">
        <Section
          title="Text Channels"
          onAdd={() => {
            setNewKind("text");
            setNewName("");
            setError(null);
            setShowCreate(true);
          }}
        >
          {textChannels.map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              active={c.id === activeChannelId}
              onSelect={() => onSelectChannel(c)}
              onDelete={isOwner ? () => deleteChannel(c.id) : undefined}
            />
          ))}
        </Section>
        <Section
          title="Voice Channels"
          onAdd={() => {
            setNewKind("voice");
            setNewName("");
            setError(null);
            setShowCreate(true);
          }}
        >
          {voiceChannels.map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              active={c.id === activeChannelId}
              onSelect={() => onSelectChannel(c)}
              onDelete={isOwner ? () => deleteChannel(c.id) : undefined}
            />
          ))}
        </Section>

        <button
          onClick={() => leaveServer(server.id)}
          className="mt-4 w-full rounded-lg px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
        >
          {isOwner ? "Delete this server" : "Leave this server"}
        </button>
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={`Create ${newKind === "text" ? "Text" : "Voice"} Channel`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-channel-form"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-glow hover:bg-primary/90"
            >
              Create
            </button>
          </>
        }
      >
        <form id="create-channel-form" onSubmit={onCreate} className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNewKind("text")}
              className={clsx(
                "flex-1 rounded-lg border px-3 py-2 text-sm",
                newKind === "text"
                  ? "border-primary bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <Hash className="mr-1 inline h-4 w-4" /> Text
            </button>
            <button
              type="button"
              onClick={() => setNewKind("voice")}
              className={clsx(
                "flex-1 rounded-lg border px-3 py-2 text-sm",
                newKind === "voice"
                  ? "border-primary bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <Volume2 className="mr-1 inline h-4 w-4" /> Voice
            </button>
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value.slice(0, LIMITS.CHANNEL_NAME_MAX))}
            maxLength={LIMITS.CHANNEL_NAME_MAX}
            placeholder="channel-name"
            required
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/30">
              {error}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title="Invite people"
      >
        <p className="text-sm text-muted-foreground">
          Share this invite code with friends to let them join <strong className="text-foreground">{server.name}</strong>.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-3 ring-1 ring-border">
          <code className="flex-1 font-mono text-lg text-foreground">{server.inviteCode}</code>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(server.inviteCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Copy className="h-3 w-3" /> {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Section({
  title,
  children,
  onAdd,
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {onAdd && (
          <button
            onClick={onAdd}
            className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function ChannelRow({
  channel,
  active,
  onSelect,
  onDelete,
}: {
  channel: Channel;
  active: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={clsx(
        "group flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition",
        active
          ? "bg-accent/40 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <button onClick={onSelect} className="flex flex-1 items-center gap-1.5 text-left">
        {channel.kind === "text" ? (
          <Hash className="h-4 w-4 shrink-0" />
        ) : (
          <Volume2 className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{channel.name}</span>
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="opacity-0 transition group-hover:opacity-100"
          title="Delete channel"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
}
