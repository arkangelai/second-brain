import { serverEnv } from "@second-brain/shared/env";

export function appUrl(path = "/"): string {
  return new URL(path, serverEnv.APP_URL).toString();
}

export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
