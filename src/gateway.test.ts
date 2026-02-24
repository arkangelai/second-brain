import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
  extractErrorDetails,
  formatStatusError,
  processSseEvent,
  streamGatewayResponse,
} from "./gateway.ts";

const originalFetch = globalThis.fetch;
const encoder = new TextEncoder();

function sseResponse(chunks: string[]): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    { status: 200 }
  );
}

describe("extractErrorDetails", () => {
  it("reads nested error message", () => {
    expect(extractErrorDetails('{"error":{"message":"bad"}}')).toBe("bad");
  });

  it("reads string error", () => {
    expect(extractErrorDetails('{"error":"bad"}')).toBe("bad");
  });

  it("falls back to message field", () => {
    expect(extractErrorDetails('{"message":"bad"}')).toBe("bad");
  });

  it("returns trimmed raw text on invalid JSON", () => {
    expect(extractErrorDetails("  not json  ")).toBe("not json");
  });
});

describe("formatStatusError", () => {
  it("formats auth errors", () => {
    expect(formatStatusError(401, "x")).toContain("authentication failed");
    expect(formatStatusError(403, "x")).toContain("authentication failed");
  });

  it("formats rate limit error", () => {
    expect(formatStatusError(429, "")).toContain("rate limit");
  });

  it("formats model not found error", () => {
    expect(formatStatusError(404, "")).toContain("Model not found");
  });

  it("formats generic status errors", () => {
    expect(formatStatusError(500, "boom")).toContain("request failed (500)");
    expect(formatStatusError(500, "boom")).toContain("boom");
  });
});

describe("processSseEvent", () => {
  it("extracts deltas", () => {
    const seen: string[] = [];
    processSseEvent('data: {"choices":[{"delta":{"content":"hello"}}]}', (d) =>
      seen.push(d)
    );
    expect(seen).toEqual(["hello"]);
  });

  it("ignores DONE and empty payloads", () => {
    const seen: string[] = [];
    processSseEvent("data: [DONE]\ndata:", (d) => seen.push(d));
    expect(seen).toEqual([]);
  });

  it("throws on chunk-level error", () => {
    expect(() =>
      processSseEvent('data: {"error":{"message":"gateway bad"}}', () => {})
    ).toThrow("gateway bad");
  });
});

describe("streamGatewayResponse", () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>).fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("surfaces network errors", async () => {
    globalThis.fetch = ((() => {
      throw new Error("offline");
    }) as unknown) as typeof fetch;

    await expect(
      streamGatewayResponse("p", "m", "k")
    ).rejects.toThrow("Network error while calling AI Gateway: offline");
  });

  it("formats HTTP errors", async () => {
    globalThis.fetch = ((async () =>
      new Response('{"error":{"message":"bad token"}}', { status: 401 })) as unknown) as typeof fetch;

    await expect(streamGatewayResponse("p", "m", "k")).rejects.toThrow(
      "authentication failed"
    );
  });

  it("throws when response body is empty", async () => {
    globalThis.fetch = ((async () => new Response(null, { status: 200 })) as unknown) as typeof fetch;
    await expect(streamGatewayResponse("p", "m", "k")).rejects.toThrow(
      "empty response body"
    );
  });

  it("streams SSE chunks and returns final text", async () => {
    globalThis.fetch = ((async () =>
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        "data: [DONE]\n\n",
      ])) as unknown) as typeof fetch;

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(
      (() => true) as never
    );
    const output = await streamGatewayResponse("prompt", "model", "key");

    expect(output).toBe("Hello world");
    expect(writeSpy).toHaveBeenCalled();
  });
});
