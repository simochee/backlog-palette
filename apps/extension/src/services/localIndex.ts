import { availablePages, type IndexEntry, issueUrl, type NavContext } from '@backlog-palette/core';
import type { RowAction } from '../messaging/ext.ts';
import type { PageContext } from '../messaging/window.ts';
import { recentVisits } from '../storage/displayCache.ts';
import { issueCommands } from './commands.ts';

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
