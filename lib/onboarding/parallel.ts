/** Bounded concurrency for onboarding bulk saves. Fail-fast after in-flight work. */

export const ONBOARDING_ROW_CONCURRENCY = 8;
export const ONBOARDING_INVITE_CONCURRENCY = 4;
export const ONBOARDING_IN_CHUNK = 80;

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let cursor = 0;
  let firstError: unknown;

  async function worker() {
    while (true) {
      if (firstError) {
        return;
      }
      const index = cursor++;
      if (index >= items.length) {
        return;
      }
      try {
        results[index] = await mapper(items[index] as T, index);
      } catch (error) {
        firstError = error;
      }
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (firstError) {
    throw firstError;
  }
  return results;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
