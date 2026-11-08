export type AiChatRole = "user" | "assistant";

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
};

export type AiChat = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AiChatMessage[];
};

const CHAT_STORAGE_PREFIX = "aiChatHistory:";

const chatStorageKey = (userId: string) => `${CHAT_STORAGE_PREFIX}${userId}`;

const isStoredChat = (value: unknown): value is AiChat => {
  if (!value || typeof value !== "object") return false;
  const chat = value as Record<string, unknown>;
  return (
    typeof chat.id === "string" &&
    typeof chat.title === "string" &&
    typeof chat.createdAt === "number" &&
    Number.isFinite(chat.createdAt) &&
    typeof chat.updatedAt === "number" &&
    Number.isFinite(chat.updatedAt) &&
    Array.isArray(chat.messages) &&
    chat.messages.every(
      (message: unknown) =>
        !!message &&
        typeof message === "object" &&
        ((message as Record<string, unknown>).role === "user" ||
          (message as Record<string, unknown>).role === "assistant") &&
        typeof (message as Record<string, unknown>).content === "string"
    )
  );
};

export const loadAiChatHistory = (userId: string): AiChat[] => {
  const raw = localStorage.getItem(chatStorageKey(userId));
  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isStoredChat)) {
    throw new Error("Saved AI chat history has an invalid format.");
  }

  return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const saveAiChatHistory = (userId: string, chats: AiChat[]) => {
  localStorage.setItem(chatStorageKey(userId), JSON.stringify(chats));
  return [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
};

export const deleteAiChatHistory = (userId: string) => {
  localStorage.removeItem(chatStorageKey(userId));
};
