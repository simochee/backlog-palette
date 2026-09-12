import { describe, expect, it } from 'vitest';
import type { SearchResultRow } from '../messaging/ext.ts';
import { previewFor } from './preview.ts';

const issue: SearchResultRow = {
  id: 'demo:issue:1',
  kind: 'issue',
  code: 'PROJ-123',
  title: 'ログイン画面のバリデーション修正',
  sub: 'Webリニューアル',
  marker: { label: '処理中', tone: 'info' },
  url: 'https://demo.backlog.jp/view/PROJ-123',
  updatedAt: new Date(2026, 8, 10, 12).getTime(),
  spaceKey: 'demo',
};

const marked = (props: ReturnType<typeof previewFor>) =>
  (props.excerpt ?? []).filter((segment) => segment.highlight === true).map((s) => s.text);

describe('選択中の行のプレビュー', () => {
  it('探した語の位置で本文がハイライトされる', () => {
    const row: SearchResultRow = {
      ...issue,
      body: `${'あ'.repeat(400)}パスワードの再設定メールが届かない`,
    };

    const preview = previewFor(row, 'パスワード');

    expect(marked(preview)).toEqual(['パスワード']);
  });

  it('本文を持たない行は抜粋を持たず、その旨を説明する', () => {
    const preview = previewFor(issue, 'ログイン');

    expect(preview.excerpt).toBeUndefined();
    expect(preview.bodylessNote).not.toBe('');
  });

  it('行と同じ識別子・件名・ステータスを見出しに出す', () => {
    const preview = previewFor(issue, 'ログイン');

    expect(preview.code).toBe('PROJ-123');
    expect(preview.title).toBe('ログイン画面のバリデーション修正');
    expect(preview.marker).toEqual({ label: '処理中', tone: 'info' });
  });

  it('どのスペースのいつの内容かが分かる', () => {
    const preview = previewFor(issue, 'ログイン');

    expect(preview.meta).toEqual([
      { label: 'スペース', value: 'demo' },
      { label: '更新', value: '2026/9/10' },
    ]);
  });
});
