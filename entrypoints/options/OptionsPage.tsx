import { useParams } from '@tanstack/react-router';
import { useEffect } from 'react';

import { useLabels } from '@/components/labels';
import { OptionsLayout } from '@/components/templates/OptionsLayout';

import { AboutSection } from './AboutSection.tsx';
import { ShortcutsSection } from './ShortcutsSection.tsx';
import { SpacesSection } from './SpacesSection.tsx';
import { text } from './text.ts';

/*
 * ルートはセクションを指すだけで、描くのは常に全セクション（1 カラムの読み物、surfaces.md §2）。
 * URL で場所を共有できるように、ルートが変わったらそのセクションまでスクロールする。
 */
export function OptionsPage() {
  const { section } = useParams({ from: '/$section' });
  const labels = useLabels();

  useEffect(() => {
    document.querySelector(`#options-${section}`)?.scrollIntoView({ block: 'start' });
  }, [section]);

  return (
    <OptionsLayout
      title={labels.brand}
      sections={[
        { id: 'spaces', title: labels.options.spacesTitle, children: <SpacesSection /> },
        { id: 'shortcuts', title: text.shortcuts.title, children: <ShortcutsSection /> },
        { id: 'about', title: text.about.title, children: <AboutSection /> },
      ]}
    />
  );
}
