import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
} from "lucide-react";
import { useChime } from "./ChimeProvider";
import { Avatar } from "./Avatar";
import type { ID } from "@/lib/chime/types";

export function CallOverlay() {
  const {
    state,
    currentUser,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  } = useChime();
  const { activeCall, localStream, remoteStreams, controls } = state;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeCall) {
      setElapsed(0);
      return;
    }
    const start = activeCall.createdAt;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [activeCall]);

  const tiles = useMemo(() => {
    if (!activeCall || !currentUser) return [];
    const ids = activeCall.participantIds;
    const states = activeCall.participantStates ?? {};
    return ids.map((uid) => {
      const isMe = uid === currentUser.id;
      const remote = states[uid];
      return {
        uid,
        isMe,
        stream: isMe ? localStream : remoteStreams[uid] ?? null,
        muted: isMe ? controls.muted : remote?.muted ?? false,
        cameraOn: isMe ? controls.cameraOn : remote?.cameraOn ?? false,
        screenSharing: isMe
          ? controls.screenSharing
          : remote?.screenSharing ?? false,
      };
    });
  }, [activeCall, currentUser, localStream, remoteStreams, controls]);

  if (!activeCall || !currentUser) return null;

  const target =
    (activeCall.channelId && state.channels[activeCall.channelId]?.name) ||
    (activeCall.chatId &&
      (state.chats[activeCall.chatId]?.name ??
        (state.chats[activeCall.chatId]?.kind === "dm"
          ? "Direct Call"
          : "Group Call"))) ||
    "Call";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-gradient-to-br from-background via-primary/30 to-accent/30 text-foreground">
      <header className="flex items-center justify-between px-6 py-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {activeCall.kind === "video" ? "Video Call" : "Voice Call"}
            {tiles.length === 1 && " — waiting for others"}
          </div>
          <div className="text-lg font-semibold">{target}</div>
        </div>
        <div className="rounded-full bg-card/50 px-3 py-1 text-sm tabular-nums">
          {formatElapsed(elapsed)}
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 pb-32">
        <div
          className={clsx(
            "grid w-full max-w-5xl gap-4",
            tiles.length === 1
              ? "grid-cols-1"
              : tiles.length === 2
              ? "grid-cols-2"
              : "grid-cols-2 md:grid-cols-3"
          )}
        >
          {tiles.map((t) => (
            <ParticipantTile
              key={t.uid}
              uid={t.uid}
              isMe={t.isMe}
              stream={t.stream}
              muted={t.muted}
              cameraOn={t.cameraOn}
              screenSharing={t.screenSharing}
            />
          ))}
        </div>
      </div>

      <footer className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full bg-card/40 px-3 py-2 backdrop-blur-sm ring-1 ring-border">
          <CallButton
            label={controls.muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
            active={!controls.muted}
          >
            {controls.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </CallButton>
          <CallButton
            label={controls.cameraOn ? "Stop video" : "Start video"}
            onClick={toggleCamera}
            active={controls.cameraOn}
          >
            {controls.cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </CallButton>
          <CallButton
            label={controls.screenSharing ? "Stop sharing" : "Share screen"}
            onClick={toggleScreenShare}
            active={controls.screenSharing}
          >
            {controls.screenSharing ? (
              <ScreenShareOff className="h-5 w-5" />
            ) : (
              <ScreenShare className="h-5 w-5" />
            )}
          </CallButton>
          <button
            onClick={endCall}
            className="ml-2 flex h-12 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/80"
            title="Leave call"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function ParticipantTile({
  uid,
  isMe,
  stream,
  muted,
  cameraOn,
  screenSharing,
}: {
  uid: ID;
  isMe: boolean;
  stream: MediaStream | null;
  muted: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
}) {
  const { state } = useChime();
  const user = state.users[uid];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream) {
      if (v.srcObject !== stream) v.srcObject = stream;
      const update = () =>
        setHasVideo(
          stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live")
        );
      update();
      const onAdd = () => update();
      stream.addEventListener("addtrack", onAdd);
      stream.addEventListener("removetrack", onAdd);
      return () => {
        stream.removeEventListener("addtrack", onAdd);
        stream.removeEventListener("removetrack", onAdd);
      };
    } else {
      v.srcObject = null;
      setHasVideo(false);
    }
  }, [stream]);

  const displayName = user?.displayName ?? "Connecting…";
  const username = user?.username ?? uid;
  const showVideo = hasVideo && (cameraOn || screenSharing);

  return (
    <div className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-2xl bg-black/40 ring-1 ring-border shadow-2xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMe}
        className={clsx(
          "absolute inset-0 h-full w-full",
          screenSharing ? "object-contain bg-black" : "object-cover",
          showVideo ? "block" : "hidden"
        )}
      />
      {!showVideo && (
        <div className="flex flex-col items-center">
          {user ? (
            <Avatar user={user} size="xl" />
          ) : (
            <div className="h-20 w-20 animate-pulse rounded-full bg-card/30" />
          )}
          <div className="mt-3 font-semibold text-foreground">{displayName}</div>
          <div className="text-xs text-muted-foreground">@{username}</div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
        <span>{displayName}</span>
        {isMe && <span className="text-white/60">(you)</span>}
        {muted && <MicOff className="h-3 w-3 text-red-400" />}
      </div>
      {screenSharing && (
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-primary/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground backdrop-blur-sm">
          <ScreenShare className="h-3 w-3" />
          Sharing screen
        </div>
      )}
    </div>
  );
}

function CallButton({
  label,
  children,
  onClick,
  active,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void | Promise<void>;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx(
        "flex h-12 w-12 items-center justify-center rounded-full transition",
        active
          ? "bg-card/40 text-foreground hover:bg-card/60"
          : "bg-card/20 text-muted-foreground hover:bg-card/40"
      )}
    >
      {children}
    </button>
  );
}

function formatElapsed(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
