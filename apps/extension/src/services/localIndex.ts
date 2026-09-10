import { availablePages, type IndexEntry, issueUrl, type NavContext } from '@backlog-palette/core';
import type { RowAction } from '../messaging/ext.ts';
import type { PageContext } from '../messaging/window.ts';
import { recentVisits } from '../storage/displayCache.ts';
import { listConnections } from './auth/connect.ts';
import { issueCommands } from './commands.ts';
import { loadAllMasters } from './masters/index.ts';

/**
 * モーダルがローカルだけで応答するための索引（実装プラン §7.2）。
 *
 * API を呼ばない。ページ定義と表示キャッシュだけで組む。接続前・オフライン
 * でも同じ候補が出ることが、この構成の目的。
 */

const ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/;

function navContextOf(ctx: PageContext): NavContext {
  return {
    origin: ctx.origin,
    ...(ctx.projectKey === undefined ? {} : { projectKey: ctx.projectKey }),
  };
}

export async function buildLocalIndex(
  ctx: PageContext,
  now: number,
): Promise<{
  entries: IndexEntry[];
  actions: Record<string, RowAction>;
}> {
  const entries: IndexEntry[] = [];
  const actions: Record<string, RowAction> = {};

  for (const command of issueCommands(ctx)) {
    entries.push(command.entry);
    actions[command.entry.id] = command.action;
  }

  /*
   * プロジェクトを索引に入れる。日本語のプロジェクト名は英字キーでも
   * 引けるよう別名に入れる（§7.1）。マスタが無ければ入らないだけで、
   * ページ移動と表示キャッシュはそのまま動く。
   */
  /*
   * ホストは接続情報から引く。スペースキーから組み立てると
   * .backlog.jp / .backlog.com / .backlogtool.com を取り違える。
   */
  const hosts = new Map((await listConnections()).map((c) => [c.spaceKey, c.host]));

  for (const masters of await loadAllMasters(now)) {
    const host = hosts.get(masters.spaceKey);
    if (host === undefined) continue;

    for (const project of masters.projects) {
      const id = `project:${masters.spaceKey}:${project.projectKey}`;
      entries.push({
        id,
        kind: 'project',
        text: project.name,
        aliases: [project.projectKey],
        code: project.projectKey,
        sub: masters.spaceKey,
        context: project.projectKey === ctx.projectKey ? 'currentProject' : 'currentSpace',
        ...(masters.spaceKey === ctx.spaceKey ? {} : { spaceKey: masters.spaceKey }),
      });
      actions[id] = {
        kind: 'navigate',
        url: `https://${host}/projects/${project.projectKey}`,
      };
    }
  }

  for (const page of availablePages(navContextOf(ctx))) {
    entries.push({
      id: `page:${page.id}`,
      kind: 'page',
      text: page.label,
      aliases: page.aliases,
      sub: page.scope === 'project' ? ctx.projectKey : 'スペース',
      context: page.scope === 'project' ? 'currentProject' : 'currentSpace',
    });
    actions[`page:${page.id}`] = { kind: 'navigate', url: page.url };
  }

  for (const visit of await recentVisits(now, 30)) {
    const id = `recent:${visit.title}`;
    if (actions[id] !== undefined) continue;

    const isIssue = visit.kind === 'issue' && ISSUE_KEY.test(visit.title);
    entries.push({
      id,
      kind: visit.kind,
      text: visit.title,
      ...(visit.projectName === undefined ? {} : { sub: visit.projectName }),
      context: 'currentSpace',
    });
    if (isIssue) {
      actions[id] = { kind: 'navigate', url: issueUrl(ctx.origin, visit.title) };
    }
  }

  return { entries, actions };
}
