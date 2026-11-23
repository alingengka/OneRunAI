/** The Claude connector's MCP endpoint (see src/lib/api/mcp.server.ts). */
import { createFileRoute } from "@tanstack/react-router";

const handle = async ({ request }: { request: Request }) =>
  (await import("@/lib/api/mcp.server")).handleMcpRequest(request);

export const Route = createFileRoute("/api/mcp")({
  server: { handlers: { POST: handle, GET: handle, DELETE: handle } },
});
