import { safeLocalStorage } from "@/lib/safe-storage";
/** Stable per-browser id KLIPY uses to tailor results. */
export function klipyCustomerId(): string {
  const key = "onerunai-klipy-customer";
  try {
    let id = safeLocalStorage().getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      safeLocalStorage().setItem(key, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}
