import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, settingsItem } from '../storage/schema.ts';
import { loadSettings, resolveColorScheme, updateSettings } from './settings.ts';

describe('設定の読み書き', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('一度も設定していなければ既定値が返る', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('学習をオフにすると次に読んだときもオフのままになる', async () => {
    await updateSettings({ learningEnabled: false });

    expect((await loadSettings()).learningEnabled).toBe(false);
  });

  it('1 つの項目を変えても、他の項目は元の値のまま残る', async () => {
    await updateSettings({ defaultSurface: 'panel' });
    await updateSettings({ colorScheme: 'dark' });

    expect(await loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      defaultSurface: 'panel',
      colorScheme: 'dark',
    });
  });

  it('設定画面に出していない項目は書き戻しで消えない', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, keywordTarget: 'subjectAndBody' });

    await updateSettings({ issueKeyFirst: false });

    expect((await loadSettings()).keywordTarget).toBe('subjectAndBody');
  });

  it('保存した値がそのまま呼び出し元に返る', async () => {
    expect(await updateSettings({ defaultSurface: 'panel' })).toEqual({
      ...DEFAULT_SETTINGS,
      defaultSurface: 'panel',
    });
  });
});

describe('カラースキームの決定', () => {
  it('システムに追従を選ぶと OS の設定どおりになる', () => {
    expect(resolveColorScheme('system', true)).toBe('dark');
    expect(resolveColorScheme('system', false)).toBe('light');
  });

  it('ライトに固定すると OS がダークでもライトのままになる', () => {
    expect(resolveColorScheme('light', true)).toBe('light');
  });

  it('ダークに固定すると OS がライトでもダークになる', () => {
    expect(resolveColorScheme('dark', false)).toBe('dark');
  });
});
