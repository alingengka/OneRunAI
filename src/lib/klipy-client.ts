/** Stable per-browser id KLIPY uses to tailor results. */
export function klipyCustomerId(): string {
  const key = "onerunai-klipy-customer";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}
