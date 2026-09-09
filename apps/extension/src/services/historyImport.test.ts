import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { currentHistoryImport, isHistoryImportOn, setHistoryImport } from './historyImport.ts';

const HISTORY = { permissions: ['history'] };

describe('ブラウザ履歴からの取り込み', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('既に履歴の読み取りを許可していれば、開いた時点で有効として出る', async () => {
    vi.spyOn(fakeBrowser.permissions, 'contains').mockImplementation(async () => true);

    expect(await currentHistoryImport()).toBe('enabled');
  });

  it('履歴の読み取りを許可していなければ無効として出る', async () => {
    vi.spyOn(fakeBrowser.permissions, 'contains').mockImplementation(async () => false);

    expect(await currentHistoryImport()).toBe('disabled');
  });

  it('オンにすると履歴の読み取り権限を要求する', async () => {
    const request = vi
      .spyOn(fakeBrowser.permissions, 'request')
      .mockImplementation(async () => true);

    expect(await setHistoryImport(true)).toBe('enabled');
    expect(request).toHaveBeenCalledWith(HISTORY);
  });

  it('権限を拒否されると取り込みは有効にならない', async () => {
    vi.spyOn(fakeBrowser.permissions, 'request').mockImplementation(async () => false);

    const outcome = await setHistoryImport(true);

    expect(outcome).toBe('declined');
    expect(isHistoryImportOn(outcome)).toBe(false);
  });

  it('オフに戻すと履歴の読み取り権限を手放す', async () => {
    const remove = vi.spyOn(fakeBrowser.permissions, 'remove').mockImplementation(async () => true);

    expect(await setHistoryImport(false)).toBe('disabled');
    expect(remove).toHaveBeenCalledWith(HISTORY);
  });

  it('オフにするときは権限を要求しない', async () => {
    const request = vi
      .spyOn(fakeBrowser.permissions, 'request')
      .mockImplementation(async () => true);
    vi.spyOn(fakeBrowser.permissions, 'remove').mockImplementation(async () => true);

    await setHistoryImport(false);

    expect(request).not.toHaveBeenCalled();
  });
});
