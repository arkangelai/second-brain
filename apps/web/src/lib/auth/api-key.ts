const API_KEY_PREFIX = "sb_live_";

export type ParsedAgentApiKey = {
  teamSlug: string;
  secret: string;
};

export function parseAgentApiKey(value: string): ParsedAgentApiKey | null {
  if (!value.startsWith(API_KEY_PREFIX)) return null;

  const rest = value.slice(API_KEY_PREFIX.length);
  const separatorIndex = rest.indexOf("_");
  if (separatorIndex <= 0 || separatorIndex === rest.length - 1) return null;

  return {
    teamSlug: rest.slice(0, separatorIndex),
    secret: rest.slice(separatorIndex + 1),
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
