import { ChoiceGroup } from '@/components/molecules/ChoiceGroup';
import { SettingRow } from '@/components/molecules/SettingRow';
import type { Settings } from '@/lib/storage/palette-items';

import type { OptionsText } from './text.ts';

type DisplaySectionProps = {
  settings: Settings;
  text: OptionsText;
  onChange: (patch: Partial<Settings>) => void;
};

const THEMES: readonly Settings['theme'][] = ['system', 'light', 'dark'];
const LANGUAGES: readonly Settings['language'][] = ['system', 'ja', 'en'];

export function DisplaySection({ settings, text, onChange }: DisplaySectionProps) {
  return (
    <>
      <SettingRow
        label={text.display.theme}
        control={
          <ChoiceGroup
            label={text.display.theme}
            value={settings.theme}
            options={THEMES.map((id) => ({ id, label: text.display.themes[id] }))}
            onChange={(theme) => onChange({ theme })}
          />
        }
      />
      <SettingRow
        label={text.display.language}
        control={
          <ChoiceGroup
            label={text.display.language}
            value={settings.language}
            options={LANGUAGES.map((id) => ({ id, label: text.display.languages[id] }))}
            onChange={(language) => onChange({ language })}
          />
        }
      />
    </>
  );
}
