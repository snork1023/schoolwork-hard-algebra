import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User as FirebaseAuthUser,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, isFirebaseConfigured, storage } from "@/integrations/firebase/client";
import type {
  Call,
  CallControls,
  Channel,
  ChannelKind,
  DirectChat,
  Friendship,
  ID,
  Message,
  Server,
  User,
} from "@/lib/chime/types";
import { CallManager, makeCallId, writeCallDoc } from "@/lib/chime/webrtc";
import {
  validateUsername,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateBio,
  validateServerName,
  validateGroupName,
  validateChannelName,
  validateMessage,
  validateInviteCode,
  validateEmoji,
  validateHexColor,
} from "@/lib/chime/sanitize";
import {
  checkRateLimit,
  formatCountdown,
  LIMITS as RATE_LIMITS,
} from "@/lib/chime/rate-limit";
import { FirebaseSetup } from "./FirebaseSetup";

const PRESET_COLORS = [
  "#7c3aed",
  "#a78bfa",
  "#6366f1",
  "#c4b5fd",
  "#8b5cf6",
  "#4f46e5",
];

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function colorForSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PRESET_COLORS[h % PRESET_COLORS.length];
}

function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

function validateImageFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return "Image must be under 4 MB.";
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Image must be PNG, JPEG, WebP, or GIF.";
  }
  return null;
}

function rateLimitError(action: keyof typeof RATE_LIMITS): string {
  const cfg = RATE_LIMITS[action];
  const r = checkRateLimit(action, cfg);
  if (r.ok) return "";
  return `Too many attempts. Try again in ${formatCountdown(r.resetsAt - Date.now())}.`;
}

interface ChimeState {
  ready: boolean;
  signedIn: boolean;
  configured: boolean;
  users: Record<ID, User>;
  friendships: Record<ID, Friendship>;
  servers: Record<ID, Server>;
  channels: Record<ID, Channel>;
  chats: Record<ID, DirectChat>;
  calls: Record<ID, Call>;
  dismissedCallIds: Set<ID>;
  activeCall: Call | null;
  localStream: MediaStream | null;
  remoteStreams: Record<ID, MediaStream>;
  controls: CallControls;
}

interface ActionResult {
  ok: boolean;
  error?: string;
}

interface ChimeContextValue {
  configured: boolean;
  state: ChimeState;
  currentUser: User | null;

  signIn: (email: string, password: string) => Promise<ActionResult>;
  signUp: (
    email: string,
    username: string,
    displayName: string,
    password: string,
    captchaToken?: string | null
  ) => Promise<ActionResult>;
  signOut: () => Promise<void>;

  updateProfile: (patch: Partial<User>) => Promise<ActionResult>;
  uploadAvatar: (file: File) => Promise<string>;
  uploadServerIcon: (serverId: ID, file: File) => Promise<string>;
  setStatus: (status: User["status"]) => Promise<void>;

  sendMessage: (channelId: ID, content: string) => Promise<ActionResult>;
  editMessage: (messageId: ID, content: string) => Promise<ActionResult>;
  deleteMessage: (messageId: ID) => Promise<void>;
  toggleReaction: (messageId: ID, emoji: string) => Promise<void>;

  createServer: (name: string, emoji: string) => Promise<Server | null>;
  joinServerByInvite: (
    code: string
  ) => Promise<ActionResult & { server?: Server }>;
  leaveServer: (serverId: ID) => Promise<void>;
  createChannel: (
    serverId: ID,
    name: string,
    kind: ChannelKind
  ) => Promise<Channel | null>;
  deleteChannel: (channelId: ID) => Promise<void>;

  sendFriendRequest: (username: string) => Promise<ActionResult>;
  acceptFriend: (friendshipId: ID) => Promise<void>;
  removeFriend: (friendshipId: ID) => Promise<void>;

  openDM: (otherUserId: ID) => Promise<DirectChat>;
  createGroup: (memberIds: ID[], name: string) => Promise<DirectChat | null>;
  leaveGroup: (chatId: ID) => Promise<void>;

  startCall: (
    target: { channelId?: ID; chatId?: ID },
    kind: Call["kind"]
  ) => Promise<void>;
  joinCall: (callId: ID) => Promise<void>;
  declineCall: (callId: ID) => void;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleDeafen: () => void;
  toggleScreenShare: () => Promise<void>;
}

const ChimeContext = createContext<ChimeContextValue | null>(null);

export function useChime() {
  const ctx = useContext(ChimeContext);
  if (!ctx) throw new Error("useChime must be used inside ChimeProvider");
  return ctx;
}

const defaultControls: CallControls = {
  muted: false,
  cameraOn: false,
  screenSharing: false,
  deafened: false,
};

export function ChimeProvider({ children }: { children: React.ReactNode }) {
  if (!isFirebaseConfigured) {
    return <FirebaseSetup />;
  }
  return <ChimeProviderInner>{children}</ChimeProviderInner>;
}

function ChimeProviderInner({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<FirebaseAuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [users, setUsers] = useState<Record<ID, User>>({});
  const [friendships, setFriendships] = useState<Record<ID, Friendship>>({});
  const [servers, setServers] = useState<Record<ID, Server>>({});
  const [channels, setChannels] = useState<Record<ID, Channel>>({});
  const [chats, setChats] = useState<Record<ID, DirectChat>>({});
  const [calls, setCalls] = useState<Record<ID, Call>>({});
  const [dismissedCallIds, setDismissedCallIds] = useState<Set<ID>>(new Set());
  const [activeCallId, setActiveCallId] = useState<ID | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<ID, MediaStream>>({});
  const [controls, setControls] = useState<CallControls>(defaultControls);
  const callManagerRef = useRef<CallManager | null>(null);

  const currentUser = authUser ? users[authUser.uid] ?? null : null;

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!authUser || !db) {
      setUsers({});
      setFriendships({});
      setServers({});
      setChannels({});
      setChats({});
      return;
    }

    const unsubs: Unsubscribe[] = [];

    unsubs.push(
      onSnapshot(collection(db, "users"), (snap) => {
        const next: Record<ID, User> = {};
        snap.forEach((d) => {
          next[d.id] = { id: d.id, ...(d.data() as Omit<User, "id">) };
        });
        setUsers(next);
      })
    );

    unsubs.push(
      onSnapshot(
        query(
          collection(db, "friendships"),
          where("userIds", "array-contains", authUser.uid)
        ),
        (snap) => {
          const next: Record<ID, Friendship> = {};
          snap.forEach((d) => {
            next[d.id] = { id: d.id, ...(d.data() as Omit<Friendship, "id">) };
          });
          setFriendships(next);
        }
      )
    );

    unsubs.push(
      onSnapshot(
        query(
          collection(db, "servers"),
          where("memberIds", "array-contains", authUser.uid)
        ),
        (snap) => {
          const next: Record<ID, Server> = {};
          snap.forEach((d) => {
            next[d.id] = { id: d.id, ...(d.data() as Omit<Server, "id">) };
          });
          setServers(next);
        }
      )
    );

    unsubs.push(
      onSnapshot(
        query(
          collection(db, "chats"),
          where("memberIds", "array-contains", authUser.uid)
        ),
        (snap) => {
          const next: Record<ID, DirectChat> = {};
          snap.forEach((d) => {
            next[d.id] = { id: d.id, ...(d.data() as Omit<DirectChat, "id">) };
          });
          setChats(next);
        }
      )
    );

    return () => {
      for (const u of unsubs) u();
    };
  }, [authUser]);

  const serverIdsKey = useMemo(
    () => Object.keys(servers).sort().join(","),
    [servers]
  );
  useEffect(() => {
    if (!authUser || !db) {
      setChannels({});
      return;
    }
    const ids = serverIdsKey ? serverIdsKey.split(",").filter(Boolean) : [];
    if (ids.length === 0) {
      setChannels({});
      return;
    }
    const unsubs: Unsubscribe[] = [];
    const groups = chunk(ids, 30);
    for (const g of groups) {
      unsubs.push(
        onSnapshot(
          query(collection(db, "channels"), where("serverId", "in", g)),
          (snap) => {
            setChannels((prev) => {
              const next = { ...prev };
              for (const k of Object.keys(next)) {
                if (g.includes(next[k].serverId)) delete next[k];
              }
              snap.forEach((d) => {
                next[d.id] = { id: d.id, ...(d.data() as Omit<Channel, "id">) };
              });
              return next;
            });
          }
        )
      );
    }
    return () => {
      for (const u of unsubs) u();
    };
  }, [authUser, serverIdsKey]);

  const signIn = useCallback<ChimeContextValue["signIn"]>(async (email, password) => {
    if (!auth) return { ok: false, error: "Firebase not configured." };

    const emailResult = validateEmail(email);
    if (!emailResult.ok) return { ok: false, error: emailResult.error };
    if (password.length === 0) return { ok: false, error: "Enter your password." };
    if (password.length > 128) return { ok: false, error: "Password is too long." };

    const rl = checkRateLimit("signIn", RATE_LIMITS.signIn);
    if (!rl.ok) {
      return {
        ok: false,
        error: `Too many sign-in attempts. Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`,
      };
    }

    try {
      await signInWithEmailAndPassword(auth, emailResult.value, password);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: humanizeAuthError(e) };
    }
  }, []);

  const signUp = useCallback<ChimeContextValue["signUp"]>(
    async (email, username, displayName, password, captchaToken) => {
      if (!auth || !db) return { ok: false, error: "Firebase not configured." };

      const emailResult = validateEmail(email);
      if (!emailResult.ok) return { ok: false, error: emailResult.error };
      const usernameResult = validateUsername(username);
      if (!usernameResult.ok) return { ok: false, error: usernameResult.error };
      const displayResult = validateDisplayName(displayName || username);
      if (!displayResult.ok) return { ok: false, error: displayResult.error };
      const passwordResult = validatePassword(password);
      if (!passwordResult.ok) return { ok: false, error: passwordResult.error };

      if (!captchaToken) {
        return { ok: false, error: "Please complete the captcha." };
      }

      const rl = checkRateLimit("signUp", RATE_LIMITS.signUp);
      if (!rl.ok) {
        return {
          ok: false,
          error: `Too many sign-up attempts from this browser. Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`,
        };
      }

      let cred;
      try {
        cred = await createUserWithEmailAndPassword(
          auth,
          emailResult.value,
          passwordResult.value
        );
      } catch (e: any) {
        return { ok: false, error: humanizeAuthError(e) };
      }

      try {
        const q = query(
          collection(db, "users"),
          where("username", "==", usernameResult.value)
        );
        const existing = await getDocs(q);
        if (!existing.empty) {
          try {
            await cred.user.delete();
          } catch {
            // ignore
          }
          return { ok: false, error: "Username already taken." };
        }

        const profile: Omit<User, "id"> = {
          username: usernameResult.value,
          displayName: displayResult.value,
          email: emailResult.value,
          avatarColor: colorForSeed(usernameResult.value),
          avatarEmoji: "💙",
          status: "online",
          bio: "",
          createdAt: Date.now(),
        };
        await setDoc(doc(db, "users", cred.user.uid), profile);
        return { ok: true };
      } catch (e: any) {
        try {
          await cred.user.delete();
        } catch {
          // ignore
        }
        return {
          ok: false,
          error:
            e?.code === "permission-denied"
              ? "Firestore rules denied this write. Publish the rules from the setup page."
              : e?.message ?? "Could not complete signup.",
        };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    if (!auth) return;
    await fbSignOut(auth);
  }, []);

  const updateProfile = useCallback<ChimeContextValue["updateProfile"]>(
    async (patch) => {
      if (!db || !authUser) return { ok: false, error: "Not signed in." };

      const rl = checkRateLimit("updateProfile", RATE_LIMITS.updateProfile);
      if (!rl.ok) {
        return {
          ok: false,
          error: `Slow down. Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`,
        };
      }

      const { id: _id, ...rest } = patch;
      const sanitized: Partial<User> = {};

      if (rest.displayName !== undefined) {
        const r = validateDisplayName(rest.displayName);
        if (!r.ok) return { ok: false, error: r.error };
        sanitized.displayName = r.value;
      }
      if (rest.bio !== undefined) {
        const r = validateBio(rest.bio);
        if (!r.ok) return { ok: false, error: r.error };
        sanitized.bio = r.value;
      }
      if (rest.avatarEmoji !== undefined) {
        sanitized.avatarEmoji = validateEmoji(rest.avatarEmoji);
      }
      if (rest.avatarColor !== undefined) {
        sanitized.avatarColor = validateHexColor(rest.avatarColor);
      }
      if (rest.avatarUrl !== undefined) {
        sanitized.avatarUrl = rest.avatarUrl;
      }
      if (rest.status !== undefined) {
        sanitized.status = rest.status;
      }

      try {
        await updateDoc(doc(db, "users", authUser.uid), stripUndefined(sanitized));
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e?.message ?? "Could not save profile." };
      }
    },
    [authUser]
  );

  const uploadAvatar = useCallback<ChimeContextValue["uploadAvatar"]>(
    async (file) => {
      if (!storage || !db || !authUser) throw new Error("Not signed in");
      const fileError = validateImageFile(file);
      if (fileError) throw new Error(fileError);

      const rl = checkRateLimit("uploadAvatar", RATE_LIMITS.uploadAvatar);
      if (!rl.ok) {
        throw new Error(
          `Too many uploads. Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`
        );
      }

      try {
        const r = ref(storage, `avatars/${authUser.uid}`);
        const snap = await uploadBytes(r, file, { contentType: file.type });
        const url = await getDownloadURL(snap.ref);
        await updateDoc(doc(db, "users", authUser.uid), { avatarUrl: url });
        return url;
      } catch (e: any) {
        if (e?.code === "storage/unauthorized") {
          throw new Error(
            "Storage denied this upload. Publish the Storage rules from the setup screen."
          );
        }
        throw e;
      }
    },
    [authUser]
  );

  const uploadServerIcon = useCallback<ChimeContextValue["uploadServerIcon"]>(
    async (serverId, file) => {
      if (!storage || !db) throw new Error("Storage not configured");
      const fileError = validateImageFile(file);
      if (fileError) throw new Error(fileError);

      const rl = checkRateLimit("uploadServerIcon", RATE_LIMITS.uploadServerIcon);
      if (!rl.ok) {
        throw new Error(
          `Too many uploads. Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`
        );
      }

      try {
        const r = ref(storage, `servers/${serverId}/icon`);
        const snap = await uploadBytes(r, file, { contentType: file.type });
        const url = await getDownloadURL(snap.ref);
        await updateDoc(doc(db, "servers", serverId), { iconUrl: url });
        return url;
      } catch (e: any) {
        if (e?.code === "storage/unauthorized") {
          throw new Error(
            "Storage denied this upload. Publish the Storage rules from the setup screen."
          );
        }
        throw e;
      }
    },
    []
  );

  const setStatus = useCallback<ChimeContextValue["setStatus"]>(
    async (status) => {
      if (!db || !authUser) return;
      if (!["online", "idle", "dnd", "offline"].includes(status)) return;
      await updateDoc(doc(db, "users", authUser.uid), { status });
    },
    [authUser]
  );

  const sendMessage = useCallback<ChimeContextValue["sendMessage"]>(
    async (channelId, content) => {
      if (!db || !authUser) return { ok: false, error: "Not signed in." };

      const messageResult = validateMessage(content);
      if (!messageResult.ok) return { ok: false, error: messageResult.error };

      const rl = checkRateLimit("sendMessage", RATE_LIMITS.sendMessage);
      if (!rl.ok) {
        return {
          ok: false,
          error: `You're sending messages too quickly. Wait ${formatCountdown(rl.resetsAt - Date.now())}.`,
        };
      }

      const m: Omit<Message, "id"> = {
        channelId,
        authorId: authUser.uid,
        content: messageResult.value,
        createdAt: Date.now(),
      };
      try {
        await addDoc(collection(db, "messages"), m);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e?.message ?? "Could not send message." };
      }
    },
    [authUser]
  );

  const editMessage = useCallback<ChimeContextValue["editMessage"]>(
    async (messageId, content) => {
      if (!db) return { ok: false, error: "Firebase not ready." };
      const messageResult = validateMessage(content);
      if (!messageResult.ok) return { ok: false, error: messageResult.error };
      await updateDoc(doc(db, "messages", messageId), {
        content: messageResult.value,
        editedAt: Date.now(),
      });
      return { ok: true };
    },
    []
  );

  const deleteMessage = useCallback<ChimeContextValue["deleteMessage"]>(
    async (messageId) => {
      if (!db) return;
      await deleteDoc(doc(db, "messages", messageId));
    },
    []
  );

  const toggleReaction = useCallback<ChimeContextValue["toggleReaction"]>(
    async (messageId, emoji) => {
      if (!db || !authUser) return;
      const safeEmoji = validateEmoji(emoji, "");
      if (!safeEmoji) return;
      const r = doc(db, "messages", messageId);
      const snap = await getDoc(r);
      if (!snap.exists()) return;
      const data = snap.data() as Message;
      const reactions = { ...(data.reactions ?? {}) };
      const list = new Set(reactions[safeEmoji] ?? []);
      if (list.has(authUser.uid)) list.delete(authUser.uid);
      else list.add(authUser.uid);
      if (list.size === 0) delete reactions[safeEmoji];
      else reactions[safeEmoji] = Array.from(list);
      await updateDoc(r, { reactions });
    },
    [authUser]
  );

  const createServer = useCallback<ChimeContextValue["createServer"]>(
    async (name, emoji) => {
      if (!db || !authUser) throw new Error("Not signed in");

      const nameResult = validateServerName(name);
      if (!nameResult.ok) throw new Error(nameResult.error);

      const rl = checkRateLimit("createServer", RATE_LIMITS.createServer);
      if (!rl.ok) {
        throw new Error(
          `You've created too many servers recently. Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`
        );
      }

      const safeEmoji = validateEmoji(emoji, "✨");
      const inviteCode = makeInviteCode();
      const serverRef = await addDoc(collection(db, "servers"), {
        name: nameResult.value,
        iconEmoji: safeEmoji,
        iconColor: colorForSeed(nameResult.value),
        ownerId: authUser.uid,
        memberIds: [authUser.uid],
        channelIds: [],
        inviteCode,
        createdAt: Date.now(),
      });
      const generalRef = await addDoc(collection(db, "channels"), {
        serverId: serverRef.id,
        name: "general",
        kind: "text",
        topic: `Welcome to ${nameResult.value}!`,
        createdAt: Date.now(),
      });
      const voiceRef = await addDoc(collection(db, "channels"), {
        serverId: serverRef.id,
        name: "general-voice",
        kind: "voice",
        createdAt: Date.now(),
      });
      await updateDoc(serverRef, {
        channelIds: [generalRef.id, voiceRef.id],
      });
      return {
        id: serverRef.id,
        name: nameResult.value,
        iconEmoji: safeEmoji,
        iconColor: colorForSeed(nameResult.value),
        ownerId: authUser.uid,
        memberIds: [authUser.uid],
        channelIds: [generalRef.id, voiceRef.id],
        inviteCode,
        createdAt: Date.now(),
      };
    },
    [authUser]
  );

  const joinServerByInvite = useCallback<ChimeContextValue["joinServerByInvite"]>(
    async (code) => {
      if (!db || !authUser) return { ok: false, error: "Sign in first." };

      const codeResult = validateInviteCode(code);
      if (!codeResult.ok) return { ok: false, error: codeResult.error };

      const rl = checkRateLimit("joinServer", RATE_LIMITS.joinServer);
      if (!rl.ok) {
        return {
          ok: false,
          error: `Slow down on the invite codes. Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`,
        };
      }

      const q = query(collection(db, "servers"), where("inviteCode", "==", codeResult.value));
      const snap = await getDocs(q);
      if (snap.empty) return { ok: false, error: "Invalid invite code." };
      const d = snap.docs[0];
      const data = d.data() as Omit<Server, "id">;
      if (!data.memberIds.includes(authUser.uid)) {
        await updateDoc(d.ref, {
          memberIds: [...data.memberIds, authUser.uid],
        });
      }
      return {
        ok: true,
        server: {
          id: d.id,
          ...data,
          memberIds: data.memberIds.includes(authUser.uid)
            ? data.memberIds
            : [...data.memberIds, authUser.uid],
        },
      };
    },
    [authUser]
  );

  const leaveServer = useCallback<ChimeContextValue["leaveServer"]>(
    async (serverId) => {
      if (!db || !authUser) return;
      const sRef = doc(db, "servers", serverId);
      const sSnap = await getDoc(sRef);
      if (!sSnap.exists()) return;
      const data = sSnap.data() as Omit<Server, "id">;
      const owner = data.ownerId === authUser.uid;
      const newMembers = data.memberIds.filter((id) => id !== authUser.uid);
      if (owner || newMembers.length === 0) {
        const chQ = query(
          collection(db, "channels"),
          where("serverId", "==", serverId)
        );
        const chs = await getDocs(chQ);
        await Promise.all(chs.docs.map((d) => deleteDoc(d.ref)));
        await deleteDoc(sRef);
      } else {
        await updateDoc(sRef, { memberIds: newMembers });
      }
    },
    [authUser]
  );

  const createChannel = useCallback<ChimeContextValue["createChannel"]>(
    async (serverId, name, kind) => {
      if (!db) throw new Error("DB not ready");
      if (kind !== "text" && kind !== "voice") throw new Error("Invalid channel kind.");

      const nameResult = validateChannelName(name);
      if (!nameResult.ok) throw new Error(nameResult.error);

      const rl = checkRateLimit("createChannel", RATE_LIMITS.createChannel);
      if (!rl.ok) {
        throw new Error(
          `Too many channels. Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`
        );
      }

      const chRef = await addDoc(collection(db, "channels"), {
        serverId,
        name: nameResult.value,
        kind,
        createdAt: Date.now(),
      });
      const sRef = doc(db, "servers", serverId);
      const sSnap = await getDoc(sRef);
      if (sSnap.exists()) {
        const data = sSnap.data() as Omit<Server, "id">;
        await updateDoc(sRef, {
          channelIds: [...data.channelIds, chRef.id],
        });
      }
      return {
        id: chRef.id,
        serverId,
        name: nameResult.value,
        kind,
        createdAt: Date.now(),
      };
    },
    []
  );

  const deleteChannel = useCallback<ChimeContextValue["deleteChannel"]>(
    async (channelId) => {
      if (!db) return;
      const chRef = doc(db, "channels", channelId);
      const chSnap = await getDoc(chRef);
      if (!chSnap.exists()) return;
      const data = chSnap.data() as Omit<Channel, "id">;
      const sRef = doc(db, "servers", data.serverId);
      const sSnap = await getDoc(sRef);
      if (sSnap.exists()) {
        const s = sSnap.data() as Omit<Server, "id">;
        await updateDoc(sRef, {
          channelIds: s.channelIds.filter((id) => id !== channelId),
        });
      }
      await deleteDoc(chRef);
    },
    []
  );

  const sendFriendRequest = useCallback<ChimeContextValue["sendFriendRequest"]>(
    async (username) => {
      if (!db || !authUser) return { ok: false, error: "Sign in first." };

      const usernameResult = validateUsername(username);
      if (!usernameResult.ok) return { ok: false, error: usernameResult.error };

      const rl = checkRateLimit("friendRequest", RATE_LIMITS.friendRequest);
      if (!rl.ok) {
        return {
          ok: false,
          error: `Slow down on friend requests. Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`,
        };
      }

      const target = Object.values(users).find(
        (u) => u.username === usernameResult.value
      );
      if (!target) {
        return { ok: false, error: "No user with that username." };
      }
      if (target.id === authUser.uid) {
        return { ok: false, error: "You can't friend yourself." };
      }
      const existing = Object.values(friendships).find(
        (f) =>
          f.userIds.includes(authUser.uid) && f.userIds.includes(target.id)
      );
      if (existing) {
        return { ok: false, error: "Friendship already exists." };
      }
      await addDoc(collection(db, "friendships"), {
        userIds: [authUser.uid, target.id],
        status: "pending",
        initiatedBy: authUser.uid,
        createdAt: Date.now(),
      });
      return { ok: true };
    },
    [authUser, users, friendships]
  );

  const acceptFriend = useCallback<ChimeContextValue["acceptFriend"]>(
    async (friendshipId) => {
      if (!db) return;
      await updateDoc(doc(db, "friendships", friendshipId), {
        status: "accepted",
      });
    },
    []
  );

  const removeFriend = useCallback<ChimeContextValue["removeFriend"]>(
    async (friendshipId) => {
      if (!db) return;
      await deleteDoc(doc(db, "friendships", friendshipId));
    },
    []
  );

  const openDM = useCallback<ChimeContextValue["openDM"]>(
    async (otherUserId) => {
      if (!db || !authUser) throw new Error("Not signed in");
      const existing = Object.values(chats).find(
        (c) =>
          c.kind === "dm" &&
          c.memberIds.length === 2 &&
          c.memberIds.includes(authUser.uid) &&
          c.memberIds.includes(otherUserId)
      );
      if (existing) return existing;
      const ref = await addDoc(collection(db, "chats"), {
        kind: "dm",
        memberIds: [authUser.uid, otherUserId],
        createdAt: Date.now(),
      });
      return {
        id: ref.id,
        kind: "dm",
        memberIds: [authUser.uid, otherUserId],
        createdAt: Date.now(),
      };
    },
    [authUser, chats]
  );

  const createGroup = useCallback<ChimeContextValue["createGroup"]>(
    async (memberIds, name) => {
      if (!db || !authUser) throw new Error("Not signed in");

      const nameResult = validateGroupName(name);
      if (!nameResult.ok) throw new Error(nameResult.error);

      const rl = checkRateLimit("createGroup", RATE_LIMITS.createGroup);
      if (!rl.ok) {
        throw new Error(
          `Too many groups created. Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`
        );
      }

      const cleanMembers = Array.from(
        new Set([authUser.uid, ...memberIds.filter((id) => typeof id === "string" && id.length > 0)])
      );
      if (cleanMembers.length < 2) throw new Error("Add at least one friend.");
      if (cleanMembers.length > 25) throw new Error("Groups can't exceed 25 members.");

      const ref = await addDoc(collection(db, "chats"), {
        kind: "group",
        name: nameResult.value || "New Group",
        memberIds: cleanMembers,
        createdAt: Date.now(),
      });
      return {
        id: ref.id,
        kind: "group",
        name: nameResult.value || "New Group",
        memberIds: cleanMembers,
        createdAt: Date.now(),
      };
    },
    [authUser]
  );

  const leaveGroup = useCallback<ChimeContextValue["leaveGroup"]>(
    async (chatId) => {
      if (!db || !authUser) return;
      const r = doc(db, "chats", chatId);
      const snap = await getDoc(r);
      if (!snap.exists()) return;
      const data = snap.data() as Omit<DirectChat, "id">;
      const newMembers = data.memberIds.filter((id) => id !== authUser.uid);
      if (newMembers.length === 0) {
        await deleteDoc(r);
      } else {
        await updateDoc(r, { memberIds: newMembers });
      }
    },
    [authUser]
  );

  useEffect(() => {
    if (!authUser || !db) {
      setCalls({});
      return;
    }
    return onSnapshot(
      query(
        collection(db, "calls"),
        where("targetMemberIds", "array-contains", authUser.uid)
      ),
      (snap) => {
        const next: Record<ID, Call> = {};
        snap.forEach((d) => {
          next[d.id] = { id: d.id, ...(d.data() as Omit<Call, "id">) };
        });
        setCalls(next);
      },
      (err) => console.error("[calls subscription]", err)
    );
  }, [authUser]);

  const activeCall = activeCallId ? calls[activeCallId] ?? null : null;

  useEffect(() => {
    const manager = callManagerRef.current;
    if (!authUser) return;

    if (activeCall && activeCall.participantIds.includes(authUser.uid)) {
      if (!manager) {
        const mgr = new CallManager(activeCall.id, authUser.uid);
        const callId = activeCall.id;
        const myId = authUser.uid;

        const writeMyState = (patch: Partial<{ muted: boolean; cameraOn: boolean; screenSharing: boolean }>) => {
          if (!db) return;
          const updates: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(patch)) {
            updates[`participantStates.${myId}.${k}`] = v;
          }
          updateDoc(doc(db, "calls", callId), updates).catch(() => {});
        };

        mgr.onLocalStream = (s) => setLocalStream(s);
        mgr.onRemoteStream = (uid, stream) => {
          setRemoteStreams((prev) => {
            if (!stream) {
              const { [uid]: _, ...rest } = prev;
              return rest;
            }
            return { ...prev, [uid]: stream };
          });
        };
        mgr.onMuteChange = (muted) => {
          setControls((c) => ({ ...c, muted }));
          writeMyState({ muted });
        };
        mgr.onCameraChange = (on) => {
          setControls((c) => ({ ...c, cameraOn: on }));
          writeMyState({ cameraOn: on });
        };
        mgr.onScreenSharingChange = (sharing) => {
          setControls((c) => ({ ...c, screenSharing: sharing }));
          writeMyState({ screenSharing: sharing });
        };
        mgr.onError = (msg) => console.warn("[call]", msg);
        callManagerRef.current = mgr;
        mgr.start(activeCall.kind).catch((e) =>
          console.error("[call.start]", e)
        );

        const initialState = {
          muted: false,
          cameraOn: activeCall.kind === "video",
          screenSharing: false,
          deafened: false,
        };
        setControls(initialState);
        writeMyState({
          muted: false,
          cameraOn: activeCall.kind === "video",
          screenSharing: false,
        });
      }
    } else if (manager) {
      manager.cleanup().catch(() => {});
      callManagerRef.current = null;
      setLocalStream(null);
      setRemoteStreams({});
      setControls(defaultControls);
    }
  }, [activeCall, authUser]);

  useEffect(() => {
    const mgr = callManagerRef.current;
    if (!mgr || !activeCall || !authUser) return;
    const others = activeCall.participantIds.filter((id) => id !== authUser.uid);
    mgr.syncPeers(others).catch((e) => console.error("[syncPeers]", e));
  }, [activeCall, authUser]);

  useEffect(() => {
    if (!authUser || !activeCallId) return;
    const c = calls[activeCallId];
    if (!c || !c.participantIds.includes(authUser.uid)) {
      setActiveCallId(null);
    }
  }, [calls, activeCallId, authUser]);

  useEffect(() => {
    const onBeforeUnload = () => {
      const c = activeCall;
      if (!c || !authUser || !db) return;
      const remaining = c.participantIds.filter((id) => id !== authUser.uid);
      if (remaining.length === 0) {
        deleteDoc(doc(db, "calls", c.id)).catch(() => {});
      } else {
        updateDoc(doc(db, "calls", c.id), { participantIds: remaining }).catch(
          () => {}
        );
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [activeCall, authUser]);

  const startCall = useCallback<ChimeContextValue["startCall"]>(
    async (target, kind) => {
      if (!authUser || !db) return;
      const me = authUser.uid;

      let targetMemberIds: ID[] = [me];
      if (target.channelId) {
        const ch = channels[target.channelId];
        const server = ch ? servers[ch.serverId] : undefined;
        if (server) targetMemberIds = Array.from(new Set([...server.memberIds, me]));
      } else if (target.chatId) {
        const chat = chats[target.chatId];
        if (chat) targetMemberIds = Array.from(new Set([...chat.memberIds, me]));
      }

      const callId = makeCallId();
      await writeCallDoc(callId, {
        channelId: target.channelId,
        chatId: target.chatId,
        initiatorId: me,
        participantIds: [me],
        targetMemberIds,
        kind,
      });
      setActiveCallId(callId);
    },
    [authUser, channels, servers, chats]
  );

  const joinCall = useCallback<ChimeContextValue["joinCall"]>(
    async (callId) => {
      if (!authUser || !db) return;
      const c = calls[callId];
      if (!c) return;
      if (!c.participantIds.includes(authUser.uid)) {
        await updateDoc(doc(db, "calls", callId), {
          participantIds: [...c.participantIds, authUser.uid],
        });
      }
      setActiveCallId(callId);
      setDismissedCallIds((prev) => {
        const next = new Set(prev);
        next.delete(callId);
        return next;
      });
    },
    [authUser, calls]
  );

  const declineCall = useCallback<ChimeContextValue["declineCall"]>((callId) => {
    setDismissedCallIds((prev) => {
      const next = new Set(prev);
      next.add(callId);
      return next;
    });
  }, []);

  const endCall = useCallback<ChimeContextValue["endCall"]>(async () => {
    const c = activeCall;
    if (!authUser || !db || !c) {
      setActiveCallId(null);
      return;
    }
    const remaining = c.participantIds.filter((id) => id !== authUser.uid);
    try {
      if (remaining.length === 0) {
        await deleteDoc(doc(db, "calls", c.id));
      } else {
        await updateDoc(doc(db, "calls", c.id), { participantIds: remaining });
      }
    } catch (e) {
      console.warn("[endCall]", e);
    }
    setActiveCallId(null);
  }, [activeCall, authUser]);

  const toggleMute = useCallback(() => {
    callManagerRef.current?.toggleMute();
  }, []);

  const toggleCamera = useCallback(() => {
    callManagerRef.current?.toggleCamera().catch((e) => console.error("[toggleCamera]", e));
  }, []);

  const toggleDeafen = useCallback(() => {
    setControls((c) => {
      const deafened = !c.deafened;
      if (deafened && !c.muted) {
        callManagerRef.current?.toggleMute();
        return { ...c, deafened };
      }
      return { ...c, deafened };
    });
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const mgr = callManagerRef.current;
    if (!mgr) return;
    if (mgr.isScreenSharing()) {
      await mgr.stopScreenShare();
    } else {
      await mgr.startScreenShare();
    }
  }, []);

  const state = useMemo<ChimeState>(
    () => ({
      ready: authReady,
      signedIn: Boolean(authUser),
      configured: true,
      users,
      friendships,
      servers,
      channels,
      chats,
      calls,
      dismissedCallIds,
      activeCall,
      localStream,
      remoteStreams,
      controls,
    }),
    [
      authReady,
      authUser,
      users,
      friendships,
      servers,
      channels,
      chats,
      calls,
      dismissedCallIds,
      activeCall,
      localStream,
      remoteStreams,
      controls,
    ]
  );

  const value = useMemo<ChimeContextValue>(
    () => ({
      configured: true,
      state,
      currentUser,
      signIn,
      signUp,
      signOut,
      updateProfile,
      uploadAvatar,
      uploadServerIcon,
      setStatus,
      sendMessage,
      editMessage,
      deleteMessage,
      toggleReaction,
      createServer,
      joinServerByInvite,
      leaveServer,
      createChannel,
      deleteChannel,
      sendFriendRequest,
      acceptFriend,
      removeFriend,
      openDM,
      createGroup,
      leaveGroup,
      startCall,
      joinCall,
      declineCall,
      endCall,
      toggleMute,
      toggleCamera,
      toggleDeafen,
      toggleScreenShare,
    }),
    [
      state,
      currentUser,
      signIn,
      signUp,
      signOut,
      updateProfile,
      uploadAvatar,
      uploadServerIcon,
      setStatus,
      sendMessage,
      editMessage,
      deleteMessage,
      toggleReaction,
      createServer,
      joinServerByInvite,
      leaveServer,
      createChannel,
      deleteChannel,
      sendFriendRequest,
      acceptFriend,
      removeFriend,
      openDM,
      createGroup,
      leaveGroup,
      startCall,
      joinCall,
      declineCall,
      endCall,
      toggleMute,
      toggleCamera,
      toggleDeafen,
      toggleScreenShare,
    ]
  );

  return <ChimeContext.Provider value={value}>{children}</ChimeContext.Provider>;
}

export function useChannelMessages(channelId: ID | undefined): Message[] {
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
    if (!db || !channelId) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, "messages"),
      where("channelId", "==", channelId)
    );
    return onSnapshot(
      q,
      (snap) => {
        const list: Message[] = [];
        snap.forEach((d) =>
          list.push({ id: d.id, ...(d.data() as Omit<Message, "id">) })
        );
        list.sort((a, b) => a.createdAt - b.createdAt);
        setMessages(list);
      },
      (err) => {
        console.error("[useChannelMessages] subscription failed", err);
      }
    );
  }, [channelId]);
  return messages;
}

function humanizeAuthError(e: any): string {
  const code = e?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "Email already in use.";
    case "auth/invalid-email":
      return "That email looks invalid.";
    case "auth/weak-password":
      return "Password must be at least 8 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a moment.";
    case "auth/network-request-failed":
      return "Network error — check your connection.";
    default:
      return e?.message ?? "Something went wrong.";
  }
}

export { documentId };
