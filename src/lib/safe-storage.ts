/**
 * localStorage, or an in-memory stand-in when the browser blocks it. Some
 * in-app browsers (Facebook, Messenger, LINE…) and private modes throw a
 * SecurityError on any touch of localStorage, which crashed the login page
 * and the editor into "This page didn't load". Work then lasts until the
 * tab closes instead of being saved.
 */
const memory = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return memory.size;
  },
  clear: () => memory.clear(),
  getItem: (key) => memory.get(key) ?? null,
  key: (index) => [...memory.keys()][index] ?? null,
  removeItem: (key) => void memory.delete(key),
  setItem: (key, value) => void memory.set(key, String(value)),
};

let resolved: Storage | null = null;

export function safeLocalStorage(): Storage {
  if (resolved) return resolved;
  try {
    const storage = window.localStorage;
    const probe = "__onerun_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    resolved = storage;
  } catch {
    resolved = memoryStorage;
  }
  return resolved;
}
