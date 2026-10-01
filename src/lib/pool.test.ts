import { runInOrderPool } from "./pool";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Results arrive out of order but are committed in index order.
{
  const delays = [40, 5, 25, 1, 15];
  const order: number[] = [];
  let inFlight = 0;
  let peak = 0;
  await runInOrderPool(
    delays.length,
    2,
    async (index) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await sleep(delays[index]!);
      inFlight--;
      return index * 10;
    },
    (index, value) => {
      assert(value === index * 10, "value matches index");
      order.push(index);
    },
  );
  assert(order.join(",") === "0,1,2,3,4", `in-order commit, got ${order}`);
  assert(peak <= 2, `concurrency limit respected, peak ${peak}`);
}

// A worker failure rejects the pool.
{
  let rejected = false;
  try {
    await runInOrderPool(
      3,
      3,
      async (index) => {
        if (index === 1) throw new Error("boom");
        return index;
      },
      () => undefined,
    );
  } catch (error) {
    rejected = error instanceof Error && error.message === "boom";
  }
  assert(rejected, "pool rejects with the worker error");
}

// Zero items is a no-op.
await runInOrderPool(
  0,
  4,
  async () => 1,
  () => {
    throw new Error("should not be called");
  },
);

console.log("pool tests passed");
