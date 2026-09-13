import { browser } from '#imports';
import { SettingRow } from '@/components/molecules/SettingRow';

import type { OptionsText } from './text.ts';

const REPOSITORY_URL = 'https://github.com/simochee/backlog-palette';

export function AboutSection({ text }: { text: OptionsText }) {
  return (
    <SettingRow
      label={text.about.version(browser.runtime.getManifest().version)}
      description={text.about.privacy}
      control={
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noreferrer"
          className="text-md text-accent underline-offset-2 hover:underline"
        >
          {text.about.repository}
        </a>
      }
    />
  );
}
