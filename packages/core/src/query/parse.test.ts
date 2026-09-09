import { describe, expect, it } from 'vitest';
import { parseQuery, searchTerm } from './parse.ts';

describe('課題キーの判定', () => {
  it('PROJ-123 は課題キーとして直接ジャンプの対象になる', () => {
    expect(parseQuery('PROJ-123')).toEqual({
      kind: 'issueKey',
      projectKey: 'PROJ',
      number: 123,
      raw: 'PROJ-123',
    });
  });

  it('アンダースコアと数字を含むプロジェクトキーも課題キーとして扱う', () => {
    expect(parseQuery('A_1-9').kind).toBe('issueKey');
  });

  it('小文字の proj-123 は課題キーにしない', () => {
    expect(parseQuery('proj-123').kind).toBe('text');
  });

  it('数字だけの入力は現在プロジェクトの課題番号として扱う', () => {
    expect(parseQuery('123')).toEqual({ kind: 'issueNumber', number: 123 });
  });

  it('前後の空白は課題キーの判定を妨げない', () => {
    expect(parseQuery('  PROJ-1  ').kind).toBe('issueKey');
  });
});

describe('加速プレフィックス', () => {
  it('> はコマンドだけに絞る', () => {
    expect(parseQuery('>ステータス')).toEqual({
      kind: 'scoped',
      scope: 'command',
      term: 'ステータス',
    });
  });

  it('全角の ＞ ＠ ＃ も半角と同じに扱う', () => {
    expect(parseQuery('＞コマンド').kind).toBe('scoped');
    expect(parseQuery('＠田中')).toEqual({ kind: 'scoped', scope: 'user', term: '田中' });
    expect(parseQuery('＃Web')).toEqual({ kind: 'scoped', scope: 'project', term: 'Web' });
  });

  it('プレフィックスだけを打った状態でも壊れない', () => {
    expect(parseQuery('>')).toEqual({ kind: 'scoped', scope: 'command', term: '' });
  });

  it('space: で特定のスペースを指定できる', () => {
    expect(parseQuery('space:acme 請求')).toEqual({
      kind: 'space',
      spaceKey: 'acme',
      term: '請求',
    });
  });
});

describe('通常の入力', () => {
  it('日本語はそのまま検索語として扱う', () => {
    expect(parseQuery('ログイン')).toEqual({ kind: 'text', term: 'ログイン' });
  });

  it('空の入力は空状態を出す合図になる', () => {
    expect(parseQuery('   ')).toEqual({ kind: 'empty' });
  });

  it('記号を含んでいてもプレフィックスでなければ検索語のまま', () => {
    expect(parseQuery('v1.2 リリース').kind).toBe('text');
  });
});

describe('一致に使う語', () => {
  it('検索語は正規化された形で取り出せる', () => {
    expect(searchTerm(parseQuery('ボード'))).toBe('ぼーど');
  });

  it('プレフィックスは一致の対象に含まれない', () => {
    expect(searchTerm(parseQuery('>ボード'))).toBe('ぼーど');
  });

  it('空の入力からは空の語が返る', () => {
    expect(searchTerm(parseQuery(''))).toBe('');
  });
});
