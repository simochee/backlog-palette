import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { connectSpace } from './connectSpace.ts';

const NOW = Date.UTC(2026, 8, 10);

describe('スペースの接続', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
  });

  it('OAuth の設定が入っていなければ、API キーへ誘導する', async () => {
    const outcome = await connectSpace({ method: 'oauth', host: 'nulab.backlog.com' }, NOW);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('notConfigured');
      expect(outcome.message).toContain('API キー');
    }
  });

  it('スペースではないホストは接続できない', async () => {
    const outcome = await connectSpace({ method: 'apiKey', host: 'example.com', apiKey: 'x' }, NOW);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('unreachable');
  });

  it('失敗の理由ごとに次の一手が分かる文言を返す', async () => {
    const outcome = await connectSpace(
      { method: 'apiKey', host: 'nulab.backlog.com', apiKey: 'wrong' },
      NOW,
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).not.toBe('');
  });

  it('結果に認証情報を含めない', async () => {
    const secret = 'super-secret-key';
    const outcome = await connectSpace(
      { method: 'apiKey', host: 'nulab.backlog.com', apiKey: secret },
      NOW,
    );

    expect(JSON.stringify(outcome)).not.toContain(secret);
  });
});
