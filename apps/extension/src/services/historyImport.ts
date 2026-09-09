import { type Browser, browser } from 'wxt/browser';

const HISTORY_PERMISSION: Browser.permissions.Permissions = { permissions: ['history'] };

export type HistoryImportOutcome = 'enabled' | 'declined' | 'disabled';

export function isHistoryImportOn(outcome: HistoryImportOutcome): boolean {
  return outcome === 'enabled';
}

export async function currentHistoryImport(): Promise<HistoryImportOutcome> {
  return (await browser.permissions.contains(HISTORY_PERMISSION)) ? 'enabled' : 'disabled';
}

/**
 * 取り込みのオン・オフは設定値ではなく権限そのもので表す（実装プラン §9）。
 * 設定に別途フラグを持つと、ユーザーがブラウザ側で権限を取り消したときに
 * 「オンなのに取り込めない」状態が残る。
 */
export async function setHistoryImport(desired: boolean): Promise<HistoryImportOutcome> {
  if (!desired) {
    await browser.permissions.remove(HISTORY_PERMISSION);
    return 'disabled';
  }

  return (await browser.permissions.request(HISTORY_PERMISSION)) ? 'enabled' : 'declined';
}
