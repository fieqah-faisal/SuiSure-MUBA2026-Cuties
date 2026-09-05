import { createFileRoute } from "@tanstack/react-router";

import { handleHealthRequest } from "@/services/ai-assistant/server";

/**
 * GET /api/health — deployment probe for the AI lane.
 *
 * Reports whether the host exposes the model API key to the server at runtime
 * and which provider will answer. With `?probe=chain` it also reads the
 * merchant credentials and their open requests from Sui Testnet. It never
 * returns the key or any part of it.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: ({ request }) => handleHealthRequest(request),
    },
  },
});
