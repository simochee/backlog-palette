import { Button } from '@/components/atoms/Button';
import { SettingRow } from '@/components/molecules/SettingRow';
import { isMacPlatform } from '@/lib/hotkey/paletteHotkey';
import { navigate } from '@/lib/tabs';

import type { OptionsText } from './text.ts';

/*
 * ⌘K は content script が捕捉していて commands には無い（D-10）ので、ブラウザの
 * ショートカット設定に項目は出ない。ここから飛べるのは拡張機能の管理画面まで。
 * chrome:// と about: は <a> では開けず、tabs.create なら拡張から開ける。
 */
const SHORTCUTS_PAGE = import.meta.env.FIREFOX ? 'about:addons' : 'chrome://extensions/shortcuts';

export function ShortcutsSection({ text }: { text: OptionsText }) {
  const hotkey = isMacPlatform(navigator.platform) ? '⌘K' : 'Ctrl+K';
  return (
    <SettingRow
      label={text.shortcuts.current(hotkey)}
      description={text.shortcuts.description}
      control={
        <Button variant="secondary" onClick={() => void navigate(SHORTCUTS_PAGE, 'new')}>
          {text.shortcuts.change}
        </Button>
      }
    />
  );
}
