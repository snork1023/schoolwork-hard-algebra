import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/integrations/firebase/client";
import type { ID } from "@/lib/chime/types";

interface PeerEntry {
  pc: RTCPeerConnection;
  audioTransceiver: RTCRtpTransceiver;
  videoTransceiver: RTCRtpTransceiver;
  remoteStream: MediaStream;
  pendingCandidates: RTCIceCandidateInit[];
  remoteSet: boolean;
  makingOffer: boolean;
}

interface Signal {
  from: ID;
  to: ID;
  kind: "offer" | "answer" | "ice" | "bye";
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  createdAt: number;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export class CallManager {
  private callId: ID;
  private myId: ID;
  private peers: Map<ID, PeerEntry> = new Map();

  private audioTrack: MediaStreamTrack | null = null;
  private cameraTrack: MediaStreamTrack | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private screenStream: MediaStream | null = null;
  private localStream: MediaStream = new MediaStream();

  private muted = false;
  private cameraOn = false;
  private screenSharing = false;

  private signalsUnsub: Unsubscribe | null = null;
  private readyResolve: (() => void) | null = null;
  private ready: Promise<void>;
  private destroyed = false;

  onLocalStream: ((stream: MediaStream) => void) | null = null;
  onRemoteStream: ((uid: ID, stream: MediaStream | null) => void) | null = null;
  onMuteChange: ((muted: boolean) => void) | null = null;
  onCameraChange: ((cameraOn: boolean) => void) | null = null;
  onScreenSharingChange: ((sharing: boolean) => void) | null = null;
  onError: ((message: string) => void) | null = null;

  constructor(callId: ID, myId: ID) {
    this.callId = callId;
    this.myId = myId;
    this.ready = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
  }

  async start(kind: "voice" | "video"): Promise<void> {
    if (!db) throw new Error("Firestore not configured");

    try {
      const initial = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video:
          kind === "video"
            ? { width: { ideal: 1280 }, height: { ideal: 720 } }
            : false,
      });
      this.audioTrack = initial.getAudioTracks()[0] ?? null;
      this.cameraTrack = initial.getVideoTracks()[0] ?? null;
      this.cameraOn = Boolean(this.cameraTrack);
    } catch (e: any) {
      this.onError?.(
        e?.name === "NotAllowedError"
          ? "Microphone/camera access was blocked. Allow it in your browser to talk."
          : `Could not access mic/camera: ${e?.message ?? e}`
      );
    }

    this.refreshLocalStream();

    this.signalsUnsub = onSnapshot(
      query(
        collection(db, "calls", this.callId, "signals"),
        where("to", "==", this.myId)
      ),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const sig = change.doc.data() as Signal;
          this.handleSignal(sig).catch((err) =>
            console.error("[CallManager] signal failed", err)
          );
          deleteDoc(change.doc.ref).catch(() => {});
        });
      },
      (err) => console.error("[CallManager] signals subscription failed", err)
    );

    this.readyResolve?.();
  }

  async syncPeers(remoteIds: ID[]): Promise<void> {
    if (this.destroyed) return;
    await this.ready;

    for (const remoteId of remoteIds) {
      if (remoteId === this.myId) continue;
      if (this.peers.has(remoteId)) continue;
      this.createPeer(remoteId);
      if (this.myId < remoteId) {
        await this.sendOffer(remoteId).catch((e) =>
          console.error("[sendOffer]", e)
        );
      }
    }

    for (const existing of Array.from(this.peers.keys())) {
      if (!remoteIds.includes(existing)) {
        this.tearDownPeer(existing);
      }
    }
  }

  private currentVideoTrack(): MediaStreamTrack | null {
    if (this.screenSharing && this.screenTrack) return this.screenTrack;
    if (this.cameraOn && this.cameraTrack) return this.cameraTrack;
    return null;
  }

  private refreshLocalStream(): void {
    const next = new MediaStream();
    if (this.audioTrack) next.addTrack(this.audioTrack);
    const v = this.currentVideoTrack();
    if (v) next.addTrack(v);
    this.localStream = next;
    this.onLocalStream?.(next);
  }

  private async refreshPeerVideo(): Promise<void> {
    const track = this.currentVideoTrack();
    for (const entry of this.peers.values()) {
      try {
        await entry.videoTransceiver.sender.replaceTrack(track);
      } catch (e) {
        console.error("[replaceTrack video]", e);
      }
    }
  }

  private createPeer(remoteId: ID): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const audioTransceiver = pc.addTransceiver("audio", {
      direction: "sendrecv",
    });
    if (this.audioTrack) {
      audioTransceiver.sender.replaceTrack(this.audioTrack).catch(() => {});
    }

    const videoTransceiver = pc.addTransceiver("video", {
      direction: "sendrecv",
    });
    const v = this.currentVideoTrack();
    if (v) videoTransceiver.sender.replaceTrack(v).catch(() => {});

    const remoteStream = new MediaStream();
    pc.ontrack = (e) => {
      if (!remoteStream.getTracks().includes(e.track)) {
        remoteStream.addTrack(e.track);
      }
      this.onRemoteStream?.(remoteId, remoteStream);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendSignal(remoteId, {
          kind: "ice",
          candidate: e.candidate.toJSON(),
        }).catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        if (this.myId < remoteId) {
          this.sendOffer(remoteId).catch(() => {});
        }
      }
    };

    const entry: PeerEntry = {
      pc,
      audioTransceiver,
      videoTransceiver,
      remoteStream,
      pendingCandidates: [],
      remoteSet: false,
      makingOffer: false,
    };
    this.peers.set(remoteId, entry);
    return entry;
  }

  private async sendOffer(remoteId: ID): Promise<void> {
    const entry = this.peers.get(remoteId);
    if (!entry) return;
    try {
      entry.makingOffer = true;
      const offer = await entry.pc.createOffer();
      if (entry.pc.signalingState === "closed") return;
      await entry.pc.setLocalDescription(offer);
      await this.sendSignal(remoteId, { kind: "offer", sdp: offer.sdp });
    } finally {
      entry.makingOffer = false;
    }
  }

  private async handleSignal(sig: Signal): Promise<void> {
    if (sig.from === this.myId) return;

    if (sig.kind === "bye") {
      this.tearDownPeer(sig.from);
      return;
    }

    let entry = this.peers.get(sig.from);
    if (!entry) {
      if (sig.kind !== "offer") return;
      entry = this.createPeer(sig.from);
    }

    if (sig.kind === "offer" && sig.sdp) {
      await entry.pc.setRemoteDescription({ type: "offer", sdp: sig.sdp });
      entry.remoteSet = true;
      for (const c of entry.pendingCandidates) {
        await entry.pc.addIceCandidate(c).catch(() => {});
      }
      entry.pendingCandidates = [];

      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      await this.sendSignal(sig.from, { kind: "answer", sdp: answer.sdp });
    } else if (sig.kind === "answer" && sig.sdp) {
      if (entry.pc.signalingState !== "have-local-offer") return;
      await entry.pc.setRemoteDescription({ type: "answer", sdp: sig.sdp });
      entry.remoteSet = true;
      for (const c of entry.pendingCandidates) {
        await entry.pc.addIceCandidate(c).catch(() => {});
      }
      entry.pendingCandidates = [];
    } else if (sig.kind === "ice" && sig.candidate) {
      if (entry.remoteSet) {
        await entry.pc.addIceCandidate(sig.candidate).catch(() => {});
      } else {
        entry.pendingCandidates.push(sig.candidate);
      }
    }
  }

  private async sendSignal(
    to: ID,
    payload: Omit<Signal, "from" | "to" | "createdAt">
  ): Promise<void> {
    if (!db) return;
    await addDoc(collection(db, "calls", this.callId, "signals"), {
      from: this.myId,
      to,
      createdAt: Date.now(),
      ...payload,
    } as Signal);
  }

  private tearDownPeer(remoteId: ID): void {
    const entry = this.peers.get(remoteId);
    if (!entry) return;
    try {
      entry.pc.close();
    } catch {
      // ignore
    }
    this.peers.delete(remoteId);
    this.onRemoteStream?.(remoteId, null);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.audioTrack) this.audioTrack.enabled = !this.muted;
    this.onMuteChange?.(this.muted);
    return this.muted;
  }

  async toggleCamera(): Promise<boolean> {
    if (this.cameraOn) {
      this.cameraOn = false;
      if (this.cameraTrack) this.cameraTrack.enabled = false;
    } else {
      if (!this.cameraTrack || this.cameraTrack.readyState === "ended") {
        try {
          const cam = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          this.cameraTrack = cam.getVideoTracks()[0] ?? null;
        } catch (e: any) {
          this.onError?.(
            e?.name === "NotAllowedError"
              ? "Camera access was blocked."
              : `Could not access camera: ${e?.message ?? e}`
          );
          this.onCameraChange?.(false);
          return false;
        }
      } else {
        this.cameraTrack.enabled = true;
      }
      this.cameraOn = true;
    }
    this.refreshLocalStream();
    await this.refreshPeerVideo();
    this.onCameraChange?.(this.cameraOn);
    return this.cameraOn;
  }

  isMuted(): boolean {
    return this.muted;
  }

  isCameraOn(): boolean {
    return this.cameraOn;
  }

  isScreenSharing(): boolean {
    return this.screenSharing;
  }

  async startScreenShare(): Promise<void> {
    if (this.screenSharing) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      this.onError?.("Your browser doesn't support screen sharing.");
      return;
    }
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    } catch (e: any) {
      if (e?.name !== "NotAllowedError") {
        this.onError?.(`Couldn't start screen share: ${e?.message ?? e}`);
      }
      return;
    }
    this.screenTrack = this.screenStream.getVideoTracks()[0] ?? null;
    if (!this.screenTrack) return;

    this.screenTrack.onended = () => {
      this.stopScreenShare().catch(() => {});
    };

    this.screenSharing = true;
    this.refreshLocalStream();
    await this.refreshPeerVideo();
    this.onScreenSharingChange?.(true);
  }

  async stopScreenShare(): Promise<void> {
    if (!this.screenSharing) return;
    this.screenSharing = false;
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
    this.screenTrack = null;
    this.refreshLocalStream();
    await this.refreshPeerVideo();
    this.onScreenSharingChange?.(false);
  }

  async cleanup(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;

    const peerIds = Array.from(this.peers.keys());
    await Promise.all(
      peerIds.map((id) =>
        this.sendSignal(id, { kind: "bye" }).catch(() => {})
      )
    );
    for (const id of peerIds) this.tearDownPeer(id);

    this.audioTrack?.stop();
    this.cameraTrack?.stop();
    this.screenTrack?.stop();
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.audioTrack = null;
    this.cameraTrack = null;
    this.screenTrack = null;
    this.screenStream = null;
    this.localStream = new MediaStream();

    this.signalsUnsub?.();
    this.signalsUnsub = null;
  }
}

export async function writeCallDoc(
  callId: ID,
  data: {
    channelId?: ID;
    chatId?: ID;
    initiatorId: ID;
    participantIds: ID[];
    targetMemberIds: ID[];
    kind: "voice" | "video";
    participantStates?: Record<
      ID,
      { muted: boolean; cameraOn: boolean; screenSharing: boolean }
    >;
  }
): Promise<void> {
  if (!db) throw new Error("DB not ready");
  await setDoc(doc(db, "calls", callId), {
    ...data,
    channelId: data.channelId ?? null,
    chatId: data.chatId ?? null,
    participantStates: data.participantStates ?? {},
    createdAt: Date.now(),
  });
}

export function makeCallId(): ID {
  return `call_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
