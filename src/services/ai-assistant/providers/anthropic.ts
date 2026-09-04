import Anthropic from "@anthropic-ai/sdk";

import { InterpretError, modelOutputSchema, type ModelOutput } from "../schemas";

import { MODEL_OUTPUT_JSON_SCHEMA, SYSTEM_PROMPT, wrapUserMessage } from "./prompt";

import type { ModelProvider } from "./types";

/**
 * The real model call.
 *
 * Three properties matter more than the prompt wording:
 *
 * - The model is never shown the merchant list, so a merchant cannot inject
 *   instructions through their registered business name.
 * - The output schema has no address, object ID or coin type field, so there is
 *   nothing for the model to hallucinate a destination into.
 * - The user's message is wrapped in a tag and named as data, so instructions
 *   inside it are extracted, not obeyed.
 */

const DEFAULT_MODEL = "claude-opus-5";
const DEFAULT_TIMEOUT_MS = 20_000;

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

export const createAnthropicProvider = (options: AnthropicProviderOptions): ModelProvider => {
  const client = new Anthropic({ apiKey: options.apiKey });
  const model = options.model ?? DEFAULT_MODEL;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    kind: "model",
    vendor: "anthropic",
    model,
    async interpret(message: string): Promise<ModelOutput> {
      let response;
      try {
        response = await client.messages.create(
          {
            model,
            max_tokens: 2048,
            system: SYSTEM_PROMPT,
            // effort low: this is a short extraction, and a payment screen that
            // takes ten seconds to appear is a worse demo than a fast one.
            output_config: {
              effort: "low",
              format: { type: "json_schema", schema: MODEL_OUTPUT_JSON_SCHEMA },
            },
            messages: [{ role: "user", content: wrapUserMessage(message) }],
          },
          { timeout, maxRetries: 1 },
        );
      } catch (error) {
        throw toInterpretError(error);
      }

      // A safety decline is not an outage and not a parse failure. Say so plainly
      // and let the caller fall back to the QR flow.
      if (response.stop_reason === "refusal") {
        throw new InterpretError(
          "AI_UNAVAILABLE",
          "The assistant declined that request. Use the QR flow instead.",
        );
      }

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
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

      // Structured outputs make malformed JSON rare, not impossible, and the
      // validation is a stated requirement of this lane. Validate anyway.
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

const toInterpretError = (error: unknown): InterpretError => {
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new InterpretError("AI_TIMEOUT", "The assistant took too long. Try again.", error);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new InterpretError("AI_UNAVAILABLE", "The assistant is busy. Try again.", error);
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new InterpretError("AI_UNAVAILABLE", "The assistant is not configured.", error);
  }
  if (error instanceof Anthropic.APIError) {
    return new InterpretError("AI_UNAVAILABLE", "The assistant is unavailable right now.", error);
  }
  return new InterpretError("AI_UNAVAILABLE", "The assistant is unavailable right now.", error);
};
