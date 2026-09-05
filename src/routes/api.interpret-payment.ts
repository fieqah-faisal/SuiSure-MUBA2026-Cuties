import { createFileRoute } from "@tanstack/react-router";

import { handleInterpretRequest, handleMethodNotAllowed } from "@/services/ai-assistant/server";

/**
 * POST /api/interpret-payment — natural language to a reviewable payment draft.
 *
 * All logic lives in `src/services/ai-assistant/**` (Member 2's lane); this
 * file is only the HTTP binding, because TanStack Start server routes must
 * live in `src/routes/`. It runs on the server only: the model API key never
 * reaches the browser.
 */
export const Route = createFileRoute("/api/interpret-payment")({
  server: {
    handlers: {
      POST: ({ request }) => handleInterpretRequest(request),
      // Without an explicit handler a GET falls through to SSR and returns the
      // app's HTML with a 200.
      GET: () => handleMethodNotAllowed("POST"),
    },
  },
});
