import { headers } from "next/headers";

import { serverEnv } from "@second-brain/shared/env";

export function appUrl(path = "/"): string {
  return new URL(path, serverEnv.APP_URL).toString();
}

export async function requestAwareAppUrl(path = "/"): Promise<string> {
  const localOrigin = localRequestOrigin(await headers());
  return new URL(path, localOrigin ?? serverEnv.APP_URL).toString();
}

export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

type HeaderReader = {
  get(name: string): string | null;
};

export function localRequestOrigin(headers: HeaderReader): string | null {
  const host = firstHeaderValue(headers.get("host")) ??
    firstHeaderValue(headers.get("x-forwarded-host"));

  if (!host || !isLocalHost(host)) {
    return null;
  }

  const protocol = localRequestProtocol(headers);
  return `${protocol}://${host}`;
}

function localRequestProtocol(headers: HeaderReader): "http" | "https" {
  const protocol = firstHeaderValue(headers.get("x-forwarded-proto"));
  return protocol === "https" ? "https" : "http";
}

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

function isLocalHost(host: string): boolean {
  try {
    const hostname = new URL(`http://${host}`).hostname
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .toLowerCase();

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
}
