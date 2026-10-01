/**
 * Run `worker` for indexes 0..count-1 with at most `limit` in flight.
 * Results are handed to `onResult` strictly in index order as soon as every
 * earlier index has finished, so in-order merging still works.
 */
export async function runInOrderPool<T>(
  count: number,
  limit: number,
  worker: (index: number) => Promise<T>,
  onResult: (index: number, result: T) => void,
): Promise<void> {
  const results = new Map<number, T>();
  let next = 0;
  let committed = 0;
  let failure: unknown = null;
  const flush = () => {
    while (results.has(committed)) {
      const result = results.get(committed) as T;
      results.delete(committed);
      onResult(committed, result);
      committed++;
    }
  };
  const lane = async () => {
    while (next < count && failure === null) {
      const index = next++;
      try {
        results.set(index, await worker(index));
        flush();
      } catch (error) {
        failure ??= error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, count) }, lane));
  if (failure !== null) throw failure;
}
