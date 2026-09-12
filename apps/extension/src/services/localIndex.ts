import { availablePages, type IndexEntry, issueUrl, type NavContext } from '@backlog-palette/core';
import type { RowAction } from '../messaging/ext.ts';
import type { PageContext } from '../messaging/window.ts';
import { recentVisits } from '../storage/displayCache.ts';
import { apiKeyPageUrl } from './apiKeyPage.ts';
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

/**
 * 表示キャッシュから起こす行の id。行動ログの entityId もこれで作る。
 * 別々に組み立てると、ずれた瞬間に frecency が引けなくなる（§7.3）。
 *
 * 件名ではなくキャッシュのキー（`{spaceKey}/{識別子}`）から作る。件名を
 * 使うと行動ログに件名が入り、「行動ログは ID・キー・種別・時刻だけ」と
 * いう約束（§9）を破る。
 */
export function recentEntryId(cacheKey: string): string {
  return `recent:${cacheKey}`;
}

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
  const connections = await listConnections();
  const hosts = new Map(connections.map((c) => [c.spaceKey, c.host]));

  /*
   * 未接続のスペースを候補の末尾に出す（モック A6）。
   *
   * 「結果が少ないのは接続していないからだ」に気づけるのは、探している
   * 最中に見えたときだけ。設定画面に置いても見に行かない。
   * 接続済みが 1 つも無いときは出さない。そのときは空状態そのものが
   * 接続を促す形になっている（C1）。
   */
  if (connections.length > 0 && ctx.spaceKey !== undefined) {
    const connected = connections.some((c) => c.spaceKey === ctx.spaceKey);
    if (!connected) {
      entries.push({
        id: 'connect-current',
        kind: 'connect',
        text: `${ctx.spaceKey} は未接続 — 接続する`,
        aliases: ['connect', 'せつぞく'],
        sub: '接続すると、このスペースの課題と Wiki も同じ検索に含まれます',
        context: 'currentSpace',
      });
      actions['connect-current'] = { kind: 'navigate', url: apiKeyPageUrl(ctx.origin) };
    }
  }

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
    const id = recentEntryId(visit.key);
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
