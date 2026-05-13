const API_KEY_PREFIX = "sb_live_";

export type ParsedAgentApiKey = {
  teamSlug: string;
  keyPrefix: string;
  secret: string;
};

export function parseAgentApiKey(value: string): ParsedAgentApiKey | null {
  if (!value.startsWith(API_KEY_PREFIX)) return null;

  const rest = value.slice(API_KEY_PREFIX.length);
  const secretSeparatorIndex = rest.lastIndexOf("_");
  if (secretSeparatorIndex <= 0 || secretSeparatorIndex === rest.length - 1) {
    return null;
  }

  const keySeparatorIndex = rest.lastIndexOf("_", secretSeparatorIndex - 1);
  if (keySeparatorIndex <= 0 || keySeparatorIndex === secretSeparatorIndex - 1) {
    return null;
  }

  return {
    teamSlug: rest.slice(0, keySeparatorIndex),
    keyPrefix: rest.slice(keySeparatorIndex + 1, secretSeparatorIndex),
    secret: rest.slice(secretSeparatorIndex + 1),
  };
}

export function getBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;

  const [scheme, token, ...extra] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || extra.length > 0) {
    return null;
  }

  return token;
}
