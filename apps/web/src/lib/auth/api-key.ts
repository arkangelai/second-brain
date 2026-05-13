const API_KEY_PREFIX = "sb_live_";

export type ParsedAgentApiKey = {
  teamSlug: string;
  keyPrefix: string;
  secret: string;
};

export function parseAgentApiKey(value: string): ParsedAgentApiKey | null {
  if (!value.startsWith(API_KEY_PREFIX)) return null;

  const rest = value.slice(API_KEY_PREFIX.length);
  const teamSeparatorIndex = rest.indexOf("_");
  if (teamSeparatorIndex <= 0 || teamSeparatorIndex === rest.length - 1) return null;

  const secretPart = rest.slice(teamSeparatorIndex + 1);
  const keySeparatorIndex = secretPart.indexOf("_");
  if (keySeparatorIndex <= 0 || keySeparatorIndex === secretPart.length - 1) {
    return null;
  }

  return {
    teamSlug: rest.slice(0, teamSeparatorIndex),
    keyPrefix: secretPart.slice(0, keySeparatorIndex),
    secret: secretPart.slice(keySeparatorIndex + 1),
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
