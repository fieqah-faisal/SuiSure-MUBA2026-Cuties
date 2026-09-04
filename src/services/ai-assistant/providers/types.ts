import type { ModelOutput } from "../schemas";

/**
 * A model provider turns one user sentence into structured payment fields.
 *
 * It is deliberately the only place in this service that can be non-deterministic.
 * Everything downstream — merchant resolution, status, confidence clamping — is
 * plain code, so swapping the provider cannot weaken any security property.
 */
export interface ModelProvider {
  /** `model` is a real model call. `heuristic` is the offline fallback. */
  readonly kind: "model" | "heuristic";
  /** Reported by /api/health so the demo never misrepresents what ran. */
  readonly vendor: "google" | "anthropic" | "none";
  readonly model: string | null;
  interpret(message: string): Promise<ModelOutput>;
}
