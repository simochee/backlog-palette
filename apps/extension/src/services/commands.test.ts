import { describe, expect, it } from 'vitest';
import { issueCommands } from './commands.ts';

const ORIGIN = 'https://simochee.backlog.com';
const onIssue = { origin: ORIGIN, spaceKey: 'simochee', projectKey: 'PROJ', issueKey: 'PROJ-123' };

const textOf = (id: string, subject?: string) => {
  const found = issueCommands(onIssue, subject).find((c) => c.entry.id === `command:${id}`);
  return found?.action.kind === 'copy' ? found.action.text : undefined;
};

describe('課題ページのコピーコマンド', () => {
  it('課題ページ以外では何も出さない', () => {
    expect(issueCommands({ origin: ORIGIN, spaceKey: 'simochee' })).toEqual([]);
  });

  it('課題キーだけをコピーできる', () => {
    expect(textOf('copy-key')).toBe('PROJ-123');
  });

  it('件名が分かれば課題キーと件名を並べてコピーする', () => {
    expect(textOf('copy-key-subject', 'ログイン画面の修正')).toBe('PROJ-123 ログイン画面の修正');
  });

  it('件名が分からなければ課題キーだけをコピーする', () => {
    expect(textOf('copy-key-subject')).toBe('PROJ-123');
  });

  it('Markdown リンクは課題キーと件名をラベルにする', () => {
    expect(textOf('copy-markdown', 'ログイン画面の修正')).toBe(
      `[PROJ-123 ログイン画面の修正](${ORIGIN}/view/PROJ-123)`,
    );
  });

  it('URL は課題ページを指す', () => {
    expect(textOf('copy-url')).toBe(`${ORIGIN}/view/PROJ-123`);
  });

  it('コピーした結果を伝える文言を持つ', () => {
    for (const command of issueCommands(onIssue)) {
      expect(command.action.kind).toBe('copy');
      if (command.action.kind === 'copy') expect(command.action.toast).not.toBe('');
    }
  });
});
