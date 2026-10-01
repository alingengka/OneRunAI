import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { translateLinesHandler, translateLinesInputValidator } from "./translate.server";

export const translateLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(translateLinesInputValidator)
  .handler(async ({ data, context }) => {
    const { assertAccess } = await import("./account.server");
    await assertAccess(context.userId);
    return translateLinesHandler({ data });
  });
