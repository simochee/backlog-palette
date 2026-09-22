import { describe, expect, it } from 'vitest';

import { apiKeyPageUrl, isConnectRequest, isMemoField, withoutConnectFragment } from './page';

describe('発行ページの判定', () => {
  it('接続行が開く URL は発行ページに #bp-connect を付けたもの', () => {
    expect(apiKeyPageUrl('https://demo.backlog.jp')).toBe(
      'https://demo.backlog.jp/EditApiSettings.action#bp-connect',
    );
  });

  it('発行ページでもフラグメントが無ければ接続の要求ではない', () => {
    expect(isConnectRequest('https://demo.backlog.jp/EditApiSettings.action#bp-connect')).toBe(
      true,
    );
    expect(isConnectRequest('https://demo.backlog.jp/EditApiSettings.action')).toBe(false);
    expect(isConnectRequest('https://demo.backlog.jp/dashboard#bp-connect')).toBe(false);
    expect(isConnectRequest('not a url')).toBe(false);
  });
});

describe('接続後の URL', () => {
  it('接続が済むと URL から #bp-connect が外れる', () => {
    expect(
      withoutConnectFragment('https://demo.backlog.jp/EditApiSettings.action#bp-connect'),
    ).toBe('https://demo.backlog.jp/EditApiSettings.action');
  });

  it('接続のもの以外のフラグメントとクエリには触れない', () => {
    expect(withoutConnectFragment('https://demo.backlog.jp/EditApiSettings.action?a=1#other')).toBe(
      'https://demo.backlog.jp/EditApiSettings.action?a=1#other',
    );
  });
});

describe('メモ欄の判定', () => {
  it('name・id・placeholder・ラベルのどれかにメモを示す語があれば埋める', () => {
    expect(isMemoField({ name: 'apiKey.memo' })).toBe(true);
    expect(isMemoField({ id: 'note' })).toBe(true);
    expect(isMemoField({ placeholder: 'メモ' })).toBe(true);
    expect(isMemoField({ label: '用途' })).toBe(true);
  });

  it('手がかりの無い入力欄は埋めない', () => {
    expect(isMemoField({ name: 'q', id: 'search', placeholder: '検索' })).toBe(false);
    expect(isMemoField({})).toBe(false);
  });
});
