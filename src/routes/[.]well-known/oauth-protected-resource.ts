/** Where Claude finds the OneRun sign-in for the MCP connector (RFC 9728). */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await import("@/lib/api/mcp.server")).protectedResourceMetadata(request),
    },
  },
});
