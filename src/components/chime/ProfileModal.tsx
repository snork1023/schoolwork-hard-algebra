import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Modal } from "./Modal";
import { useChime } from "./ChimeProvider";
import { Avatar } from "./Avatar";
import clsx from "clsx";
import { LIMITS } from "@/lib/chime/sanitize";

const PRESET_COLORS = [
  "#7c3aed",
  "#a78bfa",
  "#6366f1",
  "#c4b5fd",
  "#8b5cf6",
  "#4f46e5",
  "#3b82f6",
  "#06b6d4",
];

const PRESET_EMOJIS = ["💜", "🌊", "🚀", "☁️", "✨", "🎮", "🎧", "🧠", "🐳", "🦋"];

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentUser, updateProfile, setStatus, uploadAvatar } = useChime();
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "");
  const [bio, setBio] = useState(currentUser?.bio ?? "");
  const [emoji, setEmoji] = useState(currentUser?.avatarEmoji ?? "💜");
  const [color, setColor] = useState(currentUser?.avatarColor ?? "#7c3aed");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    currentUser?.avatarUrl
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;

  const onSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const r = await updateProfile({
        displayName,
        bio,
        avatarEmoji: emoji,
        avatarColor: color,
      });
      if (r.ok) {
        onClose();
      } else {
        setError(r.error ?? "Could not save profile.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("Image must be under 4 MB.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
    } catch (err: any) {
      setError(err?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    setError(null);
    try {
      await updateProfile({ avatarUrl: "" });
      setAvatarUrl(undefined);
    } catch (e: any) {
      setError(e?.message ?? "Could not remove avatar.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Your Profile"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-glow hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        <Avatar
          user={{
            displayName,
            username: currentUser.username,
            avatarColor: color,
            avatarEmoji: emoji,
            avatarUrl,
            status: currentUser.status,
          }}
          size="xl"
          showStatus
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPickFile}
            disabled={uploading}
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow hover:bg-primary/90 disabled:opacity-60"
          >
            <Upload className="h-3 w-3" />
            {uploading ? "Uploading..." : avatarUrl ? "Change photo" : "Upload photo"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={removeAvatar}
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
            onChange={onFileChange}
          />
        </div>
        <div className="text-sm text-muted-foreground">@{currentUser.username}</div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/30">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Display name
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, LIMITS.DISPLAY_NAME_MAX))}
            maxLength={LIMITS.DISPLAY_NAME_MAX}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, LIMITS.BIO_MAX))}
            maxLength={LIMITS.BIO_MAX}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            placeholder="Tell people a bit about you..."
          />
          <div className="mt-1 text-right text-[10px] text-muted-foreground">
            {bio.length} / {LIMITS.BIO_MAX}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fallback avatar emoji
          </label>
          <p className="text-[11px] text-muted-foreground/70">
            Shown when you don't have a profile photo.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESET_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={clsx(
                  "flex h-9 w-9 items-center justify-center rounded-lg text-xl",
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
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fallback avatar color
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={clsx(
                  "h-9 w-9 rounded-lg ring-2 transition",
                  color === c ? "ring-primary" : "ring-transparent hover:ring-border"
                )}
                style={{ backgroundColor: c }}
                aria-label={`Pick color ${c}`}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {(["online", "idle", "dnd", "offline"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={clsx(
                  "rounded-lg border px-2 py-1.5 text-xs capitalize transition",
                  currentUser.status === s
                    ? "border-primary bg-muted text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {s === "dnd" ? "Do Not Disturb" : s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
