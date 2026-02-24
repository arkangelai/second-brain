const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

interface GatewayChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

/** @internal */
export function extractErrorDetails(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as
      | { error?: { message?: string } | string; message?: string }
      | null;
    if (!parsed || typeof parsed !== "object") return raw.trim();

    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;

    return raw.trim();
  } catch {
    return raw.trim();
  }
}

/** @internal */
export function formatStatusError(status: number, details: string): string {
  const suffix = details ? ` Details: ${details}` : "";

  if (status === 401 || status === 403) {
    return `AI Gateway authentication failed (${status}). Check AI_GATEWAY_API_KEY or run second-brain config set apiKey "<key>".${suffix}`;
  }

  if (status === 429) {
    return `AI Gateway rate limit reached (429). Retry later or switch models.${suffix}`;
  }

  if (status === 404) {
    return `Model not found (404). Verify your model id (for example deepinfra/deepseek-v3.2).${suffix}`;
  }

  return `AI Gateway request failed (${status}).${suffix}`;
}

/** @internal */
export function processSseEvent(
  event: string,
  onDelta: (delta: string) => void
): void {
  if (!event) return;

  const lines = event.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;

    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    const chunk = JSON.parse(payload) as GatewayChunk;
    if (chunk.error?.message) {
      throw new Error(chunk.error.message);
    }

    const content = chunk.choices?.[0]?.delta?.content;
    if (typeof content === "string" && content.length > 0) {
      onDelta(content);
    }
  }
}

export async function streamGatewayResponse(
  prompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error while calling AI Gateway: ${message}`);
  }

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(formatStatusError(response.status, extractErrorDetails(raw)));
  }

  if (!response.body) {
    throw new Error("AI Gateway returned an empty response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/(?:\r?\n){2}/);
    buffer = events.pop() ?? "";

    for (const event of events) {
      processSseEvent(event, (delta) => {
        process.stdout.write(delta);
        fullText += delta;
      });
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    processSseEvent(buffer.trim(), (delta) => {
      process.stdout.write(delta);
      fullText += delta;
    });
  }

  return fullText;
}
