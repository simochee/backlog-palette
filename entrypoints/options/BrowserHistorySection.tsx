import { useEffect, useState } from 'react';

import { type Browser, browser } from '#imports';
import { Switch } from '@/components/atoms/Switch';
import { SettingRow } from '@/components/molecules/SettingRow';

import type { OptionsText } from './text.ts';

const HISTORY: Browser.permissions.Permissions = { permissions: ['history'] };

/*
 * トグルの状態は設定ではなく権限そのもの。オンは permissions.request で、拒否されたら
 * 戻る。オフは権限を返す。取り込み処理（過去 90 日）は後続の PR で、ここでは権限まで。
 */
export function BrowserHistorySection({ text }: { text: OptionsText }) {
  const [granted, setGranted] = useState<boolean>();

  useEffect(() => {
    void (async () => {
      setGranted(await browser.permissions.contains(HISTORY));
    })();
  }, []);

  const toggle = async (next: boolean) => {
    if (next) {
      setGranted(await browser.permissions.request(HISTORY));
      return;
    }
    const removed = await browser.permissions.remove(HISTORY);
    setGranted(!removed);
  };

  return (
    <SettingRow
      label={text.history.toggle}
      description={text.history.description}
      htmlFor="browser-history"
      control={
        <Switch
          id="browser-history"
          checked={granted === true}
          disabled={granted === undefined}
          onCheckedChange={(next) => void toggle(next)}
        />
      }
    />
  );
}
