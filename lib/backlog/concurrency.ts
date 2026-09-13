/**
 * 並列数を絞って map する。Wiki 検索はプロジェクト単位でしか呼べず（backlog-facts.md §3.3）、
 * 参加プロジェクト分を一斉に投げると search 枠（150/分）を一気に消費する。
 * 結果は入力と同じ順で返す。
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  const worker = async (): Promise<void> => {
    const index = next;
    next += 1;
    const item = items[index];
    if (item === undefined) return;
    results[index] = await task(item, index);
    await worker();
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
