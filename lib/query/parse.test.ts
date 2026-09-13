import { describe, expect, it } from 'vitest';

import { parseQuery } from './parse';

const known = new Set(['PROJ', 'MOB']);

describe('空と課題キー', () => {
  it('空文字と空白だけは空状態になる', () => {
    expect(parseQuery('')).toEqual({ kind: 'empty' });
    expect(parseQuery('   ')).toEqual({ kind: 'empty' });
  });

  it('大文字のプロジェクトキー + - + 数字は課題キーになる', () => {
    expect(parseQuery('PROJ-123')).toEqual({
      kind: 'issueKey',
      key: 'PROJ-123',
      projectKey: 'PROJ',
      number: 123,
    });
  });

  it('全角で打った課題キーも半角に畳んで課題キーになる', () => {
    expect(parseQuery('ＰＲＯＪ－１２３').kind).toBe('issueKey');
  });

  it('索引に無い大文字のキーも課題キーとして直接開ける', () => {
    expect(parseQuery('ZZZ-1', { knownProjectKeys: known }).kind).toBe('issueKey');
  });

  it('小文字で打ったキーは索引にあるプロジェクトのときだけ課題キーになる', () => {
    expect(parseQuery('proj-123', { knownProjectKeys: known })).toMatchObject({
      kind: 'issueKey',
      key: 'PROJ-123',
    });
  });

  it('索引に無い小文字のキーは自由語として検索に回す', () => {
    expect(parseQuery('zzz-1', { knownProjectKeys: known })).toEqual({
      kind: 'text',
      term: 'zzz-1',
    });
  });

  it('数字から始まる語は課題キーにならない', () => {
    expect(parseQuery('1PROJ-2').kind).toBe('text');
  });
});

describe('課題番号', () => {
  it('数字だけは現在プロジェクトがあるときその課題番号になる', () => {
    expect(parseQuery('42', { currentProjectKey: 'PROJ' })).toEqual({
      kind: 'issueNumber',
      key: 'PROJ-42',
      projectKey: 'PROJ',
      number: 42,
    });
  });

  it('現在プロジェクトが無ければ数字だけは自由語になる', () => {
    expect(parseQuery('42')).toEqual({ kind: 'text', term: '42' });
  });
});

describe('プレフィックス', () => {
  it('> はコマンドだけに絞り、語が空なら全コマンドを指す', () => {
    expect(parseQuery('>')).toEqual({ kind: 'commands', term: '' });
    expect(parseQuery('>こぴー')).toEqual({ kind: 'commands', term: 'こぴー' });
  });

  it('全角の ＞ は半角と同じくコマンド絞り込みになる', () => {
    expect(parseQuery('＞こぴー')).toEqual({ kind: 'commands', term: 'こぴー' });
  });

  it('# と ＃ はプロジェクトだけに絞る', () => {
    expect(parseQuery('#もば')).toEqual({ kind: 'projects', term: 'もば' });
    expect(parseQuery('＃もば')).toEqual({ kind: 'projects', term: 'もば' });
  });

  it('プレフィックスと語の間の空白は落とす', () => {
    expect(parseQuery('> copy')).toEqual({ kind: 'commands', term: 'copy' });
  });
});

describe('自由語', () => {
  it('それ以外は前後の空白を落とした自由語になる', () => {
    expect(parseQuery(' ログイン ')).toEqual({ kind: 'text', term: 'ログイン' });
  });
});
