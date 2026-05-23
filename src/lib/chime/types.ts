export type ID = string;

export interface User {
  id: ID;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  avatarColor: string;
  avatarEmoji?: string;
  status: "online" | "idle" | "dnd" | "offline";
  bio?: string;
  createdAt: number;
}

export interface Friendship {
  id: ID;
  userIds: [ID, ID];
  status: "pending" | "accepted" | "blocked";
  initiatedBy: ID;
  createdAt: number;
}

export interface Server {
  id: ID;
  name: string;
  iconEmoji: string;
  iconColor: string;
  iconUrl?: string;
  ownerId: ID;
  memberIds: ID[];
  channelIds: ID[];
  inviteCode: string;
  createdAt: number;
}

export type ChannelKind = "text" | "voice";

export interface Channel {
  id: ID;
  serverId: ID;
  name: string;
  kind: ChannelKind;
  topic?: string;
  createdAt: number;
}

export interface DirectChat {
  id: ID;
  kind: "dm" | "group";
  name?: string;
  memberIds: ID[];
  createdAt: number;
}

export interface Message {
  id: ID;
  channelId: ID;
  authorId: ID;
  content: string;
  createdAt: number;
  editedAt?: number;
  reactions?: Record<string, ID[]>;
}

export interface ParticipantState {
  muted: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
}

export interface Call {
  id: ID;
  channelId?: ID | null;
  chatId?: ID | null;
  initiatorId: ID;
  participantIds: ID[];
  targetMemberIds: ID[];
  participantStates?: Record<ID, ParticipantState>;
  kind: "voice" | "video";
  createdAt: number;
}

export interface CallControls {
  muted: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  deafened: boolean;
}
