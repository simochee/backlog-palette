/*
 * sections.ts と揃えて Sections.tsx にしない。大文字小文字だけ違う名前が同じディレクトリに
 * あると、macOS で oxlint の型検査だけがモジュールを解決できなくなる（tsc は通る）。
 */
import { useEffect } from 'react';

import { LabelsProvider } from '@/components/labels';
import { OptionsLayout } from '@/components/templates/OptionsLayout';
import type { Settings } from '@/lib/storage/palette-items';

import { AboutSection } from './AboutSection.tsx';
import { BrowserHistorySection } from './BrowserHistorySection.tsx';
import { CustomDomainSection } from './CustomDomainSection.tsx';
import { DisplaySection } from './DisplaySection.tsx';
import { LearningSection } from './LearningSection.tsx';
import { ShortcutsSection } from './ShortcutsSection.tsx';
import { SpacesSection } from './SpacesSection.tsx';
import { TelemetrySection } from './TelemetrySection.tsx';
import { useColorScheme } from './theme.ts';
import { resolveOptionsText } from './useOptionsText.ts';

type SectionsProps = {
  section: string;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
};

/** ルートが指すセクションまでスクロールする。描いた後でなければ対象が無い */
function useScrollToSection(section: string) {
  useEffect(() => {
    document.querySelector(`#options-${section}`)?.scrollIntoView({ block: 'start' });
  }, [section]);
}

export function OptionsSections({ section, settings, onChange }: SectionsProps) {
  useColorScheme(settings.theme);
  useScrollToSection(section);
  const { labels, text, customDomain } = resolveOptionsText(settings.language);
  const editable = { settings, text, onChange };
  return (
    <LabelsProvider labels={labels}>
      <OptionsLayout
        title={labels.brand}
        sections={[
          { id: 'spaces', title: labels.options.spacesTitle, children: <SpacesSection /> },
          {
            id: 'display',
            title: text.display.title,
            children: <DisplaySection {...editable} />,
          },
          {
            id: 'custom-domain',
            title: customDomain.title,
            description: customDomain.description,
            children: <CustomDomainSection />,
          },
          {
            id: 'learning',
            title: text.learning.title,
            children: <LearningSection {...editable} />,
          },
          {
            id: 'history',
            title: text.history.title,
            children: <BrowserHistorySection text={text} />,
          },
          {
            id: 'shortcuts',
            title: text.shortcuts.title,
            children: <ShortcutsSection text={text} />,
          },
          {
            id: 'telemetry',
            title: text.telemetry.title,
            children: <TelemetrySection {...editable} />,
          },
          { id: 'about', title: text.about.title, children: <AboutSection text={text} /> },
        ]}
      />
    </LabelsProvider>
  );
}
