import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server-only module loaded inside the handler: this file ships to the client.
export const testLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ secret: z.string().min(1).max(512) }).parse(data))
  .handler(async ({ data }) => (await import("./test-login.server")).testLogin(data.secret));
