import { InterpretError, modelOutputSchema, type ModelOutput } from "../schemas.ts";

import { GEMINI_RESPONSE_SCHEMA, SYSTEM_PROMPT, wrapUserMessage } from "./prompt.ts";

import type { ModelProvider } from "./types.ts";

/**
 * Google Gemini provider, via the REST API.
 *
 * No SDK: one POST with `fetch` keeps the server bundle small and the failure
 * modes visible, and the request shape is stable across SDK releases.
 *
 * Model choice matters more than usual here. Measured on 5 September 2026
 * with this exact request: `gemini-3.5-flash-lite` answers in about 1.4 s,
 * `gemini-3.5-flash` reasons first and took 7.5 s, and `gemini-2.5-flash-lite`
 * now returns 404 for new keys. A payment screen that takes eight seconds to
 * appear is a worse demo than one that appears in one.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_TIMEOUT_MS = 15_000;

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string };
}

export interface GeminiProviderOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

export const createGeminiProvider = (options: GeminiProviderOptions): ModelProvider => {
  const model = options.model ?? DEFAULT_GEMINI_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    kind: "model",
    vendor: "google",
    model,

    async interpret(message: string): Promise<ModelOutput> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // Header, never a query string: a key in a URL ends up in logs and
            // proxy history.
            "x-goog-api-key": options.apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: wrapUserMessage(message) }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 1024,
              responseMimeType: "application/json",
              responseSchema: GEMINI_RESPONSE_SCHEMA,
              // Gemini 3 models accept a thinking level; "minimal" keeps this
              // short extraction fast. Older model names reject the field.
              ...(/^gemini-3/.test(model) ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}),
            },
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new InterpretError("AI_TIMEOUT", "The assistant took too long. Try again.", error);
        }
        throw new InterpretError(
          "AI_UNAVAILABLE",
          "The assistant is unavailable right now.",
          error,
        );
      } finally {
        clearTimeout(timer);
      }

      const body = (await response.json().catch(() => ({}))) as GeminiResponse;

      if (!response.ok) {
        // 429 is the free tier's quota, and it is the one a demo actually hits.
        const userMessage =
          response.status === 429
            ? "The assistant has hit its request quota. Try again in a minute or use the QR flow."
            : response.status === 401 || response.status === 403
              ? "The assistant is not configured on this server."
              : "The assistant is unavailable right now.";
        throw new InterpretError("AI_UNAVAILABLE", userMessage, body.error ?? response.status);
      }

      if (body.promptFeedback?.blockReason) {
        throw new InterpretError(
          "AI_UNAVAILABLE",
          "The assistant declined that request. Use the QR flow instead.",
          body.promptFeedback.blockReason,
        );
      }

      const candidate = body.candidates?.[0];
      if (candidate?.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
        throw new InterpretError(
          "AI_UNAVAILABLE",
          "The assistant declined that request. Use the QR flow instead.",
          candidate.finishReason,
        );
      }

      // Parts can carry reasoning alongside the answer; only answer text counts.
      const text = (candidate?.content?.parts ?? [])
        .filter((part) => !part.thought)
        .map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!text) {
        throw new InterpretError("AI_INVALID_OUTPUT", "The assistant returned an empty answer.");
      }

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch (error) {
        throw new InterpretError(
          "AI_INVALID_OUTPUT",
          "The assistant returned an unusable answer.",
          error,
        );
      }

      // responseSchema makes malformed output rare, not impossible. Validate
      // anyway — this is the boundary where untrusted model output becomes data.
      const parsed = modelOutputSchema.safeParse(json);
      if (!parsed.success) {
        throw new InterpretError(
          "AI_INVALID_OUTPUT",
          "The assistant returned an answer that failed validation.",
          parsed.error,
        );
      }
      return parsed.data;
    },
  };
};
