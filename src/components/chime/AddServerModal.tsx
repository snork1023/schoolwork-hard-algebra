import { useRef, useState } from "react";
import clsx from "clsx";
import { Upload, X } from "lucide-react";
import { Modal } from "./Modal";
import { useChime } from "./ChimeProvider";
import type { Server } from "@/lib/chime/types";
import { LIMITS } from "@/lib/chime/sanitize";

const ICONS = ["💬", "🎮", "🎨", "🎧", "📚", "🚀", "🌊", "✨", "🐳"];

export function AddServerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (server: Server) => void;
}) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { createServer, joinServerByInvite, uploadServerIcon } = useChime();

  const [busy, setBusy] = useState(false);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("Image must be under 4 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    setError(null);
    setIconFile(file);
    const url = URL.createObjectURL(file);
    setIconPreview(url);
  };

  const clearFile = () => {
    setIconFile(null);
    if (iconPreview) URL.revokeObjectURL(iconPreview);
    setIconPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      const s = await createServer(name.trim(), emoji);
      if (!s) {
        setError("Could not create server.");
        return;
      }
      let server = s;
      if (iconFile) {
        try {
          const url = await uploadServerIcon(s.id, iconFile);
          server = { ...s, iconUrl: url };
        } catch (err: any) {
          setError(err?.message ?? "Server created, but icon upload failed.");
        }
      }
      setName("");
      setEmoji("💬");
      clearFile();
      onClose();
      onCreated(server);
    } catch (err: any) {
      setError(err?.message ?? "Could not create server.");
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await joinServerByInvite(code);
      if (!r.ok || !r.server) {
        setError(r.error ?? "Could not join server.");
        return;
      }
      setCode("");
      onClose();
      onCreated(r.server);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Servers">
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("create")}
          className={clsx(
            "flex-1 rounded-lg border px-3 py-2 text-sm transition",
            tab === "create"
              ? "border-primary bg-muted text-foreground"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          Create a Server
        </button>
        <button
          onClick={() => setTab("join")}
          className={clsx(
            "flex-1 rounded-lg border px-3 py-2 text-sm transition",
            tab === "join"
              ? "border-primary bg-muted text-foreground"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          Join a Server
        </button>
      </div>

      {tab === "create" ? (
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Server name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, LIMITS.SERVER_NAME_MAX))}
              maxLength={LIMITS.SERVER_NAME_MAX}
              required
              placeholder="My Cool Server"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Server icon
            </label>
            <div className="mt-2 flex items-start gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-border bg-muted">
                {iconPreview ? (
                  <img src={iconPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl">{emoji}</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow hover:bg-primary/90"
                  >
                    <Upload className="h-3 w-3" />
                    {iconFile ? "Change image" : "Upload image"}
                  </button>
                  {iconFile && (
                    <button
                      type="button"
                      onClick={clearFile}
                      className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground ring-1 ring-border hover:bg-accent/40"
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={onPickFile}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Or pick an emoji below. Image overrides the emoji.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ICONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={clsx(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-lg transition",
                        emoji === e
                          ? "bg-accent/40 ring-2 ring-primary"
                          : "bg-muted hover:bg-accent/40"
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/30">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Working..." : "Create Server"}
          </button>
        </form>
      ) : (
        <form onSubmit={onJoin} className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Invite code
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.slice(0, LIMITS.INVITE_CODE_LEN).toUpperCase())}
              maxLength={LIMITS.INVITE_CODE_LEN}
              required
              placeholder="ABCDEF"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground uppercase tracking-widest outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/30">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Working..." : "Join Server"}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Ask a friend for their server's invite code, or create your own!
          </p>
        </form>
      )}
    </Modal>
  );
}
