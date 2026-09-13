import { Switch } from '@/components/atoms/Switch';
import { SettingRow } from '@/components/molecules/SettingRow';
import type { Settings } from '@/lib/storage/palette-items';

import type { OptionsText } from './text.ts';

type TelemetrySectionProps = {
  settings: Settings;
  text: OptionsText;
  onChange: (patch: Partial<Settings>) => void;
};

export function TelemetrySection({ settings, text, onChange }: TelemetrySectionProps) {
  return (
    <SettingRow
      label={text.telemetry.toggle}
      description={text.telemetry.description}
      htmlFor="telemetry"
      control={
        <Switch
          id="telemetry"
          checked={settings.telemetry}
          onCheckedChange={(telemetry) => onChange({ telemetry })}
        />
      }
    />
  );
}
