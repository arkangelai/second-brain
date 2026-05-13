import { randomBytes } from "node:crypto";

import argon2 from "argon2";

export const AGENT_KEY_SECRET_BYTES = 32;
export const AGENT_KEY_SECRET_LENGTH = 43;
export const AGENT_KEY_RANDOM_PREFIX_LENGTH = 8;

const TEAM_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const AGENT_KEY_PATTERN = new RegExp(
  `^sb_live_([a-z0-9][a-z0-9-]{0,62})_([A-Za-z0-9_-]{${AGENT_KEY_SECRET_LENGTH}})$`,
);

export type GeneratedAgentKey = {
  plaintext: string;
  prefix: string;
};

export type ParsedAgentKey = {
  plaintext: string;
  teamSlug: string;
  secret: string;
  prefix: string;
};

export function generateKey(teamSlug: string): GeneratedAgentKey {
  const normalizedSlug = normalizeTeamSlug(teamSlug);
  const secret = randomBytes(AGENT_KEY_SECRET_BYTES).toString("base64url");
  const plaintext = `sb_live_${normalizedSlug}_${secret}`;

  return {
    plaintext,
    prefix: keyPrefix(normalizedSlug, secret),
  };
}

export async function hashKey(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, {
    type: argon2.argon2id,
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyKey(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  if (!plaintext || !hash) return false;

  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

export function parseAgentKey(plaintext: string): ParsedAgentKey | null {
  const match = AGENT_KEY_PATTERN.exec(plaintext);
  if (!match) return null;

  const [, teamSlug, secret] = match;

  return {
    plaintext,
    teamSlug: teamSlug.toLowerCase(),
    secret,
    prefix: keyPrefix(teamSlug.toLowerCase(), secret),
  };
}

function normalizeTeamSlug(teamSlug: string): string {
  const normalizedSlug = teamSlug.trim().toLowerCase();

  if (!TEAM_SLUG_PATTERN.test(normalizedSlug)) {
    throw new Error("Team slug must contain only letters, numbers, or hyphens");
  }

  return normalizedSlug;
}

function keyPrefix(teamSlug: string, secret: string): string {
  return `sb_live_${teamSlug}_${secret.slice(0, AGENT_KEY_RANDOM_PREFIX_LENGTH)}`;
}
