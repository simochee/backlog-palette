import { describe, expect, it } from 'vitest';

import { documentEntry, issueEntry, statusBadge, typeBadge, wikiEntry } from './entries';

const HOST = 'demo.backlog.jp';
const project = { id: 101, projectKey: 'PROJ', name: 'Webリニューアル', useWiki: true };
const user = (name: string) => ({ name });

describe('課題を行の形にする', () => {
  it('課題キー・件名・担当者・更新者・ステータスと種別のバッジ・URL を持つ', () => {
    const issue = {
      projectId: 101,
      issueKey: 'PROJ-123',
      summary: 'ログイン画面のバリデーション修正',
      issueType: { name: 'バグ', color: '#990000' },
      status: { id: 2, name: '処理中' },
      assignee: user('田中'),
      updatedUser: user('鈴木'),
      updated: '2026-09-10T00:00:00Z',
    };

    expect(issueEntry(HOST, issue, project)).toEqual({
      kind: 'issue',
      id: 'PROJ-123',
      key: 'PROJ-123',
      title: 'ログイン画面のバリデーション修正',
      spaceId: HOST,
      projectId: '101',
      projectName: 'Webリニューアル',
      assignee: '田中',
      updatedBy: '鈴木',
      status: { label: '処理中', tone: 'info' },
      type: { label: 'バグ', tone: 'danger' },
      url: 'https://demo.backlog.jp/view/PROJ-123',
    });
  });
});

describe('担当者の無い課題', () => {
  it('担当者が無い課題は assignee を持たない', () => {
    const issue = {
      projectId: 101,
      issueKey: 'PROJ-1',
      summary: 's',
      issueType: { name: 'タスク', color: '#7ea800' },
      status: { id: 1, name: '未対応' },
      updatedUser: user('鈴木'),
      updated: '2026-09-10T00:00:00Z',
    };

    expect(issueEntry(HOST, issue, project)).not.toHaveProperty('assignee');
  });

  it('API が未割り当てを null で返した課題も assignee を持たない', () => {
    const issue = {
      projectId: 101,
      issueKey: 'PROJ-2',
      summary: 's',
      issueType: { name: 'タスク', color: '#7ea800' },
      status: { id: 1, name: '未対応' },
      assignee: null,
      updatedUser: user('鈴木'),
      updated: '2026-09-10T00:00:00Z',
    };

    expect(issueEntry(HOST, issue, project)).not.toHaveProperty('assignee');
  });
});

describe('バッジの色', () => {
  it('組み込みのステータスは ID で色が決まり、カスタムは neutral', () => {
    expect(statusBadge({ id: 1, name: '未対応' }).tone).toBe('neutral');
    expect(statusBadge({ id: 3, name: '処理済み' }).tone).toBe('success');
    expect(statusBadge({ id: 4, name: '完了' }).tone).toBe('done');
    expect(statusBadge({ id: 10101, name: 'レビュー待ち' }).tone).toBe('neutral');
  });

  it('赤系の種別だけ danger、他は info', () => {
    expect(typeBadge({ name: 'バグ', color: '#e30000' }).tone).toBe('danger');
    expect(typeBadge({ name: 'タスク', color: '#7ea800' }).tone).toBe('info');
  });
});

describe('Wiki とドキュメント', () => {
  it('Wiki は ID 指定の URL、ドキュメントはプロジェクトキー入りの URL を持つ', () => {
    const updated = '2026-09-10T00:00:00Z';
    const wiki = {
      id: 5,
      projectId: 101,
      name: 'リリース手順',
      updatedUser: user('佐藤'),
      updated,
    };
    const document = {
      id: 'doc-a1B2c3',
      projectId: 101,
      title: '障害対応',
      updatedUser: user('高橋'),
      updated,
    };

    expect(wikiEntry(HOST, wiki, project)).toMatchObject({
      kind: 'wiki',
      id: '5',
      updatedBy: '佐藤',
      url: 'https://demo.backlog.jp/alias/wiki/5',
    });
    expect(documentEntry(HOST, document, project)).toMatchObject({
      kind: 'document',
      id: 'doc-a1B2c3',
      url: 'https://demo.backlog.jp/document/PROJ/doc-a1B2c3',
    });
  });
});
