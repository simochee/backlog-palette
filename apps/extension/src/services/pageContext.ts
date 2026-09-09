/**
 * Backlog のページ URL から、表示キャッシュに残す情報を取り出す。
 *
 * URL とページタイトルだけを見る。API は呼ばない（実装プラン §9）。
 * ページ由来の値なので、スコープの初期値と並びにしか使わない（§2.3）。
 */

export type VisitedPage = {
  spaceKey: string;
  id: string;
  title: string;
  projectName?: string;
  kind: 'issue' | 'wiki' | 'document' | 'project';
};

const SPACE = /^https:\/\/([a-z0-9-]+)\.(?:backlog\.(?:jp|com)|backlogtool\.com)$/;
const ISSUE_PATH = /^\/view\/([A-Z][A-Z0-9_]*-\d+)/;
const WIKI_PATH = /^\/wiki\/([A-Z][A-Z0-9_]*)\/(.+)$/;
const PROJECT_PATH = /^\/(?:projects|find|board|gantt|file|git)\/([A-Z][A-Z0-9_]*)/;

/**
 * `document.title` からプロジェクト名を切り出す。
 *
 * 形式は未確認（未決 #8）なので、区切りが見つからなければ諦める。
 * ここで推測して間違った文字列を保存すると、stale-while-revalidate が
 * 走るまで誤った件名が表示され続ける。
 */
function splitTitle(documentTitle: string): { head: string; projectName?: string } {
  const separator = documentTitle.lastIndexOf(' | ');
  if (separator === -1) return { head: documentTitle.trim() };

  return {
    head: documentTitle.slice(0, separator).trim(),
    projectName: documentTitle.slice(separator + 3).trim(),
  };
}

export function readVisitedPage(href: string, documentTitle: string): VisitedPage | undefined {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }

  const spaceKey = SPACE.exec(url.origin)?.[1];
  if (spaceKey === undefined) return undefined;

  const { head, projectName } = splitTitle(documentTitle);
  const withProject = projectName === undefined ? {} : { projectName };

  const issueKey = ISSUE_PATH.exec(url.pathname)?.[1];
  if (issueKey !== undefined) {
    return { spaceKey, id: issueKey, title: head || issueKey, kind: 'issue', ...withProject };
  }

  const wiki = WIKI_PATH.exec(url.pathname);
  if (wiki?.[1] !== undefined && wiki[2] !== undefined) {
    const name = decodeURIComponent(wiki[2]);
    return {
      spaceKey,
      id: `wiki/${wiki[1]}/${name}`,
      title: head || name,
      kind: 'wiki',
      ...withProject,
    };
  }

  const projectKey = PROJECT_PATH.exec(url.pathname)?.[1];
  if (projectKey !== undefined) {
    return {
      spaceKey,
      id: `project/${projectKey}`,
      title: head || projectKey,
      kind: 'project',
      ...withProject,
    };
  }

  return undefined;
}
