import { createServerFn } from "@tanstack/react-start";
import { translateLinesHandler, translateLinesInputValidator } from "./translate.server";

export const translateLines = createServerFn({ method: "POST" })
  .inputValidator(translateLinesInputValidator)
  .handler(translateLinesHandler);
