/**
 * document.title の解析。Backlog の title は「件名 | プロジェクト名」の形と見ているが、
 * 台帳に無く未確認（mvp-evaluation §5）。形式が合わなければ件名を採らず、URL から読める
 * 課題キーだけを残す（surfaces.md §3）。推測でプロジェクト名を切り出さない
 */
const SEPARATOR = ' | ';

export type ParsedTitle = {
  /** 件名。先頭の課題キーは取り除く */
  summary: string;
  /** 区切りの右側。プロジェクト名と見ているが、そのまま持つだけ */
  context: string;
};

export function parseTitle(title: string, issueKey?: string): ParsedTitle | undefined {
  const at = title.lastIndexOf(SEPARATOR);
  if (at === -1) return undefined;
  const context = title.slice(at + SEPARATOR.length).trim();
  let summary = title.slice(0, at).trim();
  if (issueKey !== undefined && summary.toUpperCase().startsWith(`${issueKey.toUpperCase()} `))
    summary = summary.slice(issueKey.length).trim();
  if (summary === '' || context === '') return undefined;
  return { summary, context };
}

/** 形式が合わなければ課題キーだけ。件名が読めればそれを表示に使う */
export function displayTitle(title: string, issueKey: string): string {
  return parseTitle(title, issueKey)?.summary ?? issueKey;
}
