/** The same metadata at the path-specific address some MCP clients try first. */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/.well-known/oauth-protected-resource/api/mcp")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await import("@/lib/api/mcp.server")).protectedResourceMetadata(request),
    },
  },
});
