import { describe, expect, it } from "bun:test";
import {
  parsePublicEnv,
  parseServerEnv,
} from "@second-brain/shared/env";

const validServer = {
  SUPABASE_SECRET_KEY: "sb_secret_abc123",
  AI_GATEWAY_API_KEY: "gw_abc",
  RESEND_API_KEY: "re_abc",
  APP_URL: "https://second-brain.example.com",
  EMAIL_FROM: "noreply@example.com",
};

const anonJwtPayload = Buffer.from(
  JSON.stringify({ role: "anon", iss: "supabase" })
).toString("base64url");
const anonJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${anonJwtPayload}.signature`;

const serviceRoleJwtPayload = Buffer.from(
  JSON.stringify({ role: "service_role", iss: "supabase" })
).toString("base64url");
const serviceRoleJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${serviceRoleJwtPayload}.signature`;

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "https://your-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonJwt,
  NEXT_PUBLIC_APP_NAME: "Second Brain",
};

describe("parseServerEnv", () => {
  it("parses a fully populated server env", () => {
    const env = parseServerEnv(validServer);
    expect(env.APP_URL).toBe(validServer.APP_URL);
    expect(env.EMAIL_FROM).toBe(validServer.EMAIL_FROM);
  });

  it("allows Resend to be unset for dev email logging", () => {
    const { RESEND_API_KEY: _resend, ...withoutResend } = validServer;

    const env = parseServerEnv({ ...withoutResend, NODE_ENV: "development" });

    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("allows Resend to be unset for preview deployments", () => {
    const { RESEND_API_KEY: _resend, ...withoutResend } = validServer;

    const env = parseServerEnv({
      ...withoutResend,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    });

    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("requires Resend for production deployments", () => {
    const { RESEND_API_KEY: _resend, ...withoutResend } = validServer;

    expect(() =>
      parseServerEnv({
        ...withoutResend,
        NODE_ENV: "production",
        VERCEL_ENV: "production",
      })
    ).toThrow(/RESEND_API_KEY/);
  });

  it("lists every missing var in a single error", () => {
    try {
      parseServerEnv({});
      throw new Error("expected parseServerEnv to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain("SUPABASE_SECRET_KEY");
      expect(message).toContain("AI_GATEWAY_API_KEY");
      expect(message).toContain("APP_URL");
      expect(message).toContain("EMAIL_FROM");
      expect(message).toContain(".env.example");
    }
  });

  it("rejects an invalid APP_URL", () => {
    expect(() =>
      parseServerEnv({ ...validServer, APP_URL: "not-a-url" })
    ).toThrow(/APP_URL/);
  });

  it("rejects an invalid EMAIL_FROM", () => {
    expect(() =>
      parseServerEnv({ ...validServer, EMAIL_FROM: "not-an-email" })
    ).toThrow(/EMAIL_FROM/);
  });
});

describe("parsePublicEnv", () => {
  it("parses a fully populated public env", () => {
    const env = parsePublicEnv(validPublic);
    expect(env.NEXT_PUBLIC_APP_NAME).toBe("Second Brain");
  });

  it("defaults the public app name when missing", () => {
    const { NEXT_PUBLIC_APP_NAME: _appName, ...withoutAppName } = validPublic;

    const env = parsePublicEnv(withoutAppName);

    expect(env.NEXT_PUBLIC_APP_NAME).toBe("Second Brain");
  });

  it("rejects a non-URL NEXT_PUBLIC_SUPABASE_URL", () => {
    expect(() =>
      parsePublicEnv({ ...validPublic, NEXT_PUBLIC_SUPABASE_URL: "broken" })
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("blocks a service-role JWT from appearing in NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
    expect(() =>
      parsePublicEnv({
        ...validPublic,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: serviceRoleJwt,
      })
    ).toThrow(/secret key/);
  });

  it("blocks an sb_secret_* key from appearing in NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
    expect(() =>
      parsePublicEnv({
        ...validPublic,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_abc123",
      })
    ).toThrow(/secret key/);
  });

  it("accepts an anon JWT in NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
    expect(() => parsePublicEnv(validPublic)).not.toThrow();
  });

  it("accepts an sb_publishable_* key in NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
    expect(() =>
      parsePublicEnv({
        ...validPublic,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abc123",
      })
    ).not.toThrow();
  });

  it("lists every missing var in a single error", () => {
    try {
      parsePublicEnv({});
      throw new Error("expected parsePublicEnv to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(message).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
  });
});
