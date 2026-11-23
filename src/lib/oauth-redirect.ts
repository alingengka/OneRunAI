/**
 * Anyone can register an OAuth client (dynamic registration is on for
 * Claude), so only hand sign-ins to Claude's own callback, or to an app on
 * this computer (Claude Code listens on localhost).
 */
export function trustedRedirect(uri: string): "claude" | "local" | null {
  try {
    const url = new URL(uri);
    if (
      url.protocol === "https:" &&
      (url.hostname === "claude.ai" || url.hostname === "claude.com") &&
      url.pathname === "/api/mcp/auth_callback"
    ) {
      return "claude";
    }
    if (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    ) {
      return "local";
    }
  } catch {
    /* not a URL */
  }
  return null;
}
