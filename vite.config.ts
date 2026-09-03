// @lovable.dev/vite-tanstack-config already provides the required
// TanStack Start, React, Tailwind, and Nitro plugins.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Package the production server for Firebase App Hosting.
  nitro: {
    preset: "firebase-app-hosting",
  },

  tanstackStart: {
    // Use the existing SSR error-wrapper entry.
    server: {
      entry: "server",
    },
  },
});
