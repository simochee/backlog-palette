import { useParams } from '@tanstack/react-router';

import { settings as settingsItem } from '@/lib/storage/palette-items';

import { OptionsSections } from './OptionsSections.tsx';
import { useStorageItem } from './useStorageItem.ts';

/*
 * ルートはセクションを指すだけで、描くのは常に全セクション（1 カラムの読み物、surfaces.md §2）。
 * URL で場所を共有できるように、ルートが変わったらそのセクションまでスクロールする。
 * 保存ボタンは無く、変えた項目をその場で settings に書き戻す。
 */
export function OptionsPage() {
  const { section } = useParams({ from: '/$section' });
  const settings = useStorageItem(settingsItem);

  // 読み込み前に fallback の既定値で描くと、切り替えた直後に一瞬戻って見える
  if (settings === undefined) return null;
  return (
    <OptionsSections
      section={section}
      settings={settings}
      onChange={(patch) => void settingsItem.setValue({ ...settings, ...patch })}
    />
  );
}
