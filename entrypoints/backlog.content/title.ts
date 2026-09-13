/*
 * document.title の解析は lib/title/ に集まる予定（担当: M2）。それまでの最小の判定。
 * Backlog の title は「件名 | プロジェクト名」の形と見ているが未確認なので、
 * ' | ' で区切れないときは件名を採らず、URL から読めるキーだけを残す（surfaces.md §3）。
 */
export function summaryFromTitle(title: string): string | undefined {
  const [summary, ...rest] = title.split(' | ');
  if (rest.length === 0 || summary === undefined) return undefined;
  const trimmed = summary.trim();
  return trimmed === '' ? undefined : trimmed;
}
