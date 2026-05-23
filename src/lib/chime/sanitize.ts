export const LIMITS = {
  USERNAME_MIN: 3,
  USERNAME_MAX: 20,
  DISPLAY_NAME_MIN: 1,
  DISPLAY_NAME_MAX: 32,
  EMAIL_MAX: 254,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  BIO_MAX: 200,
  SERVER_NAME_MAX: 32,
  CHANNEL_NAME_MAX: 24,
  GROUP_NAME_MAX: 32,
  MESSAGE_MAX: 2000,
  INVITE_CODE_LEN: 6,
} as const;

const USERNAME_RE = /^[a-z0-9_]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const INVITE_CODE_RE = /^[A-Z0-9]+$/;
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const ZERO_WIDTH_RE = /[​-‍﻿]/g;

const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "system", "support", "help",
  "moderator", "mod", "staff", "official", "chime", "everyone", "here",
  "null", "undefined", "anonymous", "anon", "me", "you",
]);

export interface ValidationResult {
  ok: boolean;
  value: string;
  error?: string;
}

function fail(error: string): ValidationResult {
  return { ok: false, value: "", error };
}
function pass(value: string): ValidationResult {
  return { ok: true, value };
}

function clean(s: string): string {
  return s.replace(CONTROL_CHARS_RE, "").replace(ZERO_WIDTH_RE, "").trim();
}

export function validateUsername(raw: string): ValidationResult {
  const value = clean(raw).toLowerCase();
  if (value.length < LIMITS.USERNAME_MIN) {
    return fail(`Username must be at least ${LIMITS.USERNAME_MIN} characters.`);
  }
  if (value.length > LIMITS.USERNAME_MAX) {
    return fail(`Username must be ${LIMITS.USERNAME_MAX} characters or fewer.`);
  }
  if (!USERNAME_RE.test(value)) {
    return fail("Username can only contain lowercase letters, numbers, and underscores.");
  }
  if (RESERVED_USERNAMES.has(value)) {
    return fail("That username is reserved. Pick another.");
  }
  return pass(value);
}

export function validateDisplayName(raw: string): ValidationResult {
  const value = clean(raw);
  if (value.length < LIMITS.DISPLAY_NAME_MIN) {
    return fail("Display name can't be empty.");
  }
  if (value.length > LIMITS.DISPLAY_NAME_MAX) {
    return fail(`Display name must be ${LIMITS.DISPLAY_NAME_MAX} characters or fewer.`);
  }
  return pass(value);
}

export function validateEmail(raw: string): ValidationResult {
  const value = clean(raw).toLowerCase();
  if (value.length === 0) return fail("Email is required.");
  if (value.length > LIMITS.EMAIL_MAX) {
    return fail("That email is too long.");
  }
  if (!EMAIL_RE.test(value)) {
    return fail("That doesn't look like a valid email.");
  }
  return pass(value);
}

export function validatePassword(raw: string): ValidationResult {
  if (raw.length < LIMITS.PASSWORD_MIN) {
    return fail(`Password must be at least ${LIMITS.PASSWORD_MIN} characters.`);
  }
  if (raw.length > LIMITS.PASSWORD_MAX) {
    return fail(`Password must be ${LIMITS.PASSWORD_MAX} characters or fewer.`);
  }
  return pass(raw);
}

export function validateBio(raw: string): ValidationResult {
  const value = clean(raw);
  if (value.length > LIMITS.BIO_MAX) {
    return fail(`Bio must be ${LIMITS.BIO_MAX} characters or fewer.`);
  }
  return pass(value);
}

export function validateServerName(raw: string): ValidationResult {
  const value = clean(raw);
  if (value.length === 0) return fail("Server name is required.");
  if (value.length > LIMITS.SERVER_NAME_MAX) {
    return fail(`Server name must be ${LIMITS.SERVER_NAME_MAX} characters or fewer.`);
  }
  return pass(value);
}

export function validateGroupName(raw: string): ValidationResult {
  const value = clean(raw);
  if (value.length > LIMITS.GROUP_NAME_MAX) {
    return fail(`Group name must be ${LIMITS.GROUP_NAME_MAX} characters or fewer.`);
  }
  return pass(value);
}

export function validateChannelName(raw: string): ValidationResult {
  const value = clean(raw).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (value.length === 0) return fail("Channel name is required.");
  if (value.length > LIMITS.CHANNEL_NAME_MAX) {
    return fail(`Channel name must be ${LIMITS.CHANNEL_NAME_MAX} characters or fewer.`);
  }
  return pass(value);
}

export function validateMessage(raw: string): ValidationResult {
  const value = raw.replace(CONTROL_CHARS_RE, "").trimEnd();
  if (value.trim().length === 0) {
    return fail("Message can't be empty.");
  }
  if (value.length > LIMITS.MESSAGE_MAX) {
    return fail(`Message must be ${LIMITS.MESSAGE_MAX} characters or fewer.`);
  }
  return pass(value);
}

export function validateInviteCode(raw: string): ValidationResult {
  const value = clean(raw).toUpperCase();
  if (value.length !== LIMITS.INVITE_CODE_LEN) {
    return fail(`Invite codes are ${LIMITS.INVITE_CODE_LEN} characters.`);
  }
  if (!INVITE_CODE_RE.test(value)) {
    return fail("Invite codes contain only letters and numbers.");
  }
  return pass(value);
}

const SAFE_EMOJI_RE = /^[\p{Extended_Pictographic}\p{Emoji_Component}]{1,4}$/u;
export function validateEmoji(raw: string, fallback = "💙"): string {
  const value = clean(raw);
  if (!value) return fallback;
  return SAFE_EMOJI_RE.test(value) ? value : fallback;
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export function validateHexColor(raw: string, fallback = "#2570f5"): string {
  return HEX_COLOR_RE.test(raw) ? raw : fallback;
}
