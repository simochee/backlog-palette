import { useState } from 'react';

import { Button } from '@/components/atoms/Button';
import { Switch } from '@/components/atoms/Switch';
import { SettingRow } from '@/components/molecules/SettingRow';
import type { Settings } from '@/lib/storage/palette-items';

import { clearHistory } from './history.ts';
import type { OptionsText } from './text.ts';

type LearningSectionProps = {
  settings: Settings;
  text: OptionsText;
  onChange: (patch: Partial<Settings>) => void;
};

type ClearState = 'idle' | 'confirming' | 'done';

/** 消去は 1 回目で確認、2 回目で実行（surfaces.md §2）。完了後は「消去しました」に変わる */
function ClearHistoryButton({ text }: { text: OptionsText }) {
  const [state, setState] = useState<ClearState>('idle');
  const label = {
    idle: text.learning.clearButton,
    confirming: text.learning.clearConfirm,
    done: text.learning.cleared,
  }[state];
  return (
    <Button
      variant={state === 'confirming' ? 'primary' : 'secondary'}
      tone="danger"
      disabled={state === 'done'}
      onClick={() => {
        if (state !== 'confirming') {
          setState('confirming');
          return;
        }
        void (async () => {
          await clearHistory();
          setState('done');
        })();
      }}
    >
      {label}
    </Button>
  );
}

export function LearningSection({ settings, text, onChange }: LearningSectionProps) {
  return (
    <>
      <SettingRow
        label={text.learning.toggle}
        description={text.learning.toggleDescription}
        htmlFor="learning"
        control={
          <Switch
            id="learning"
            checked={settings.learning}
            onCheckedChange={(learning) => onChange({ learning })}
          />
        }
      />
      <SettingRow
        label={text.learning.clear}
        description={text.learning.clearDescription}
        control={<ClearHistoryButton text={text} />}
      />
    </>
  );
}
