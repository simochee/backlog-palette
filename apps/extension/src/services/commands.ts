import type { IndexEntry } from '@backlog-palette/core';
import { issueUrl } from '@backlog-palette/core';
import type { RowAction } from '../messaging/ext.ts';
import type { PageContext } from '../messaging/window.ts';

/**
 * 現在のページに対して打てるコマンド（実装プラン §3.1 のコピー系）。
 *
 * 書き込み系は Phase 2。ここにあるのは今いる場所から取れる情報の
 * コピーだけなので、API も認証も要らない。
 */

export type Command = {
  entry: IndexEntry;
  action: RowAction;
};

/** 課題ページで開いているときだけ意味を持つコマンドを組む */
export function issueCommands(ctx: PageContext, subject?: string): Command[] {
  if (ctx.issueKey === undefined) return [];

  const key = ctx.issueKey;
  const url = issueUrl(ctx.origin, key);
  const withSubject = subject === undefined ? key : `${key} ${subject}`;

  const command = (id: string, text: string, action: RowAction): Command => ({
    entry: {
      id: `command:${id}`,
      kind: 'command',
      text,
      sub: key,
      context: 'currentProject',
    },
    action,
  });

  return [
    command('copy-key', '課題キーをコピー', {
      kind: 'copy',
      text: key,
      toast: `${key} をコピーしました`,
    }),
    command('copy-key-subject', '課題キーと件名をコピー', {
      kind: 'copy',
      text: withSubject,
      toast: '課題キーと件名をコピーしました',
    }),
    command('copy-markdown', 'Markdown リンクをコピー', {
      kind: 'copy',
      text: `[${withSubject}](${url})`,
      toast: 'Markdown リンクをコピーしました',
    }),
    command('copy-url', 'URL をコピー', {
      kind: 'copy',
      text: url,
      toast: 'URL をコピーしました',
    }),
  ];
}
