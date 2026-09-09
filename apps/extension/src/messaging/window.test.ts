import { describe, expect, it } from 'vitest';
import { isFromIframe, isToIframe, isTrustedPageOrigin } from './window.ts';

describe('パレットに open を送れるオリジン', () => {
  it('Backlog のスペースは信頼する', () => {
    expect(isTrustedPageOrigin('https://nulab.backlog.jp')).toBe(true);
    expect(isTrustedPageOrigin('https://acme.backlog.com')).toBe(true);
  });

  it('登録済みのカスタムドメインは信頼する', () => {
    expect(isTrustedPageOrigin('https://backlog.example.co.jp', ['backlog.example.co.jp'])).toBe(
      true,
    );
  });

  it('未登録のドメインは信頼しない', () => {
    expect(isTrustedPageOrigin('https://backlog.example.co.jp')).toBe(false);
  });

  it('Backlog に見せかけたドメインを信頼しない', () => {
    expect(isTrustedPageOrigin('https://evil.backlog.jp.example.com')).toBe(false);
    expect(isTrustedPageOrigin('https://nulab.backlog.jp.evil.com')).toBe(false);
  });

  it('http は信頼しない', () => {
    expect(isTrustedPageOrigin('http://nulab.backlog.jp')).toBe(false);
  });
});

describe('受け付けるメッセージ', () => {
  it('open / close 以外は iframe へ渡さない', () => {
    expect(isToIframe({ t: 'open', ctx: { origin: 'https://nulab.backlog.jp' } })).toBe(true);
    expect(isToIframe({ t: 'close' })).toBe(true);
    expect(isToIframe({ t: 'navigate', url: 'https://evil.example.com' })).toBe(false);
    expect(isToIframe({ t: 'resize', height: 400 })).toBe(false);
    expect(isToIframe('open')).toBe(false);
    expect(isToIframe(null)).toBe(false);
  });

  it('close 以外は content script へ渡さない', () => {
    expect(isFromIframe({ t: 'close' })).toBe(true);
    expect(isFromIframe({ t: 'open', ctx: {} })).toBe(false);
    expect(isFromIframe({ t: 'navigate', url: 'https://evil.example.com' })).toBe(false);
  });
});
