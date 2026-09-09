import { Error as BacklogJsErrors } from 'backlog-js';
import { describe, expect, it } from 'vitest';
import {
  BacklogRequestError,
  failureFromCause,
  failureFromStatus,
  isBacklogRequestError,
  spaceKeyFromHost,
} from './errors.ts';

describe('スペースキーの取り出し', () => {
  it('ホストの先頭ラベルがスペースキーになる', () => {
    expect(spaceKeyFromHost('nulab.backlog.jp')).toBe('nulab');
    expect(spaceKeyFromHost('acme.backlog.com')).toBe('acme');
  });

  it('旧ドメインの backlogtool.com でも同じスペースキーになる', () => {
    expect(spaceKeyFromHost('nulab.backlogtool.com')).toBe('nulab');
  });

  it('Git のリモートホストでもスペースキーは先頭ラベルのまま', () => {
    expect(spaceKeyFromHost('nulab.git.backlog.com')).toBe('nulab');
  });

  it('Backlog のドメインでないホストはホストごと識別子にする', () => {
    expect(spaceKeyFromHost('backlog.example')).toBe('backlog.example');
    expect(spaceKeyFromHost('localhost')).toBe('localhost');
  });

  it('大文字のホストでも同じスペースキーになる', () => {
    expect(spaceKeyFromHost('NuLab.Backlog.JP')).toBe('nulab');
  });
});

describe('HTTP ステータスの写像', () => {
  it('401 は再接続が必要なエラーになる', () => {
    expect(failureFromStatus(401, 'nulab')).toEqual({
      kind: 'unauthorized',
      spaceKey: 'nulab',
      retryable: false,
      status: 401,
    });
  });

  it('権限不足の 403 は再接続では直らないので unauthorized にしない', () => {
    expect(failureFromStatus(403, 'nulab')).toMatchObject({
      kind: 'unknown',
      retryable: false,
    });
  });

  it('404 は見つからなかったこととして扱う', () => {
    expect(failureFromStatus(404, 'nulab')).toMatchObject({
      kind: 'notFound',
      retryable: false,
    });
  });

  it('429 はレート超過で、待てば通るので再試行できる', () => {
    expect(failureFromStatus(429, 'nulab')).toMatchObject({
      kind: 'rateLimited',
      retryable: true,
    });
  });

  it('429 には枠が開く時刻を添えられる', () => {
    expect(failureFromStatus(429, 'nulab', 1_789_000_000_000).retryAt).toBe(1_789_000_000_000);
  });

  it('サーバ側の 500 番台は再試行できる不明なエラーになる', () => {
    expect(failureFromStatus(503, 'nulab')).toMatchObject({ kind: 'unknown', retryable: true });
  });

  it('リクエストが悪い 400 は再試行しても直らない', () => {
    expect(failureFromStatus(400, 'nulab')).toMatchObject({ kind: 'unknown', retryable: false });
  });
});

describe('例外の写像', () => {
  it('fetch がネットワークに届かなかったときはオフラインとして扱う', () => {
    expect(failureFromCause(new TypeError('Failed to fetch'), 'nulab')).toEqual({
      kind: 'offline',
      spaceKey: 'nulab',
      retryable: true,
    });
  });

  it('backlog-js の認証エラーからも 401 を読み取る', () => {
    const cause = new BacklogJsErrors.BacklogAuthError(new Response(null, { status: 401 }));

    expect(failureFromCause(cause, 'nulab')).toMatchObject({ kind: 'unauthorized', status: 401 });
  });

  it('backlog-js の API エラーからステータスを読み取る', () => {
    const cause = new BacklogJsErrors.BacklogApiError(new Response(null, { status: 429 }));

    expect(failureFromCause(cause, 'nulab')).toMatchObject({ kind: 'rateLimited', status: 429 });
  });

  it('中断はオフラインではなく不明なエラーにする', () => {
    const cause = new DOMException('aborted', 'AbortError');

    expect(failureFromCause(cause, 'nulab')).toMatchObject({ kind: 'unknown' });
  });

  it('素性の分からない値でもスペースキーの付いたエラーになる', () => {
    expect(failureFromCause('なにか', 'acme')).toEqual({
      kind: 'unknown',
      spaceKey: 'acme',
      retryable: false,
    });
  });
});

describe('投げられるエラー', () => {
  it('種別とスペースキーを持ち、他の例外と見分けられる', () => {
    const error = new BacklogRequestError(failureFromStatus(401, 'nulab'));

    expect(error).toBeInstanceOf(Error);
    expect(isBacklogRequestError(error)).toBe(true);
    expect(isBacklogRequestError(new Error('401'))).toBe(false);
    expect(error.kind).toBe('unauthorized');
    expect(error.spaceKey).toBe('nulab');
  });

  it('メッセージには種別とスペースキーしか出さない', () => {
    const error = new BacklogRequestError(failureFromStatus(401, 'nulab'));

    expect(error.message).toBe('unauthorized: nulab');
  });

  it('失敗の内容はそのまま取り出せる', () => {
    const failure = failureFromStatus(429, 'acme', 1_789_000_000_000);

    expect(new BacklogRequestError(failure).failure).toEqual(failure);
  });
});
