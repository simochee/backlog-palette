import type { Decorator, Preview } from '@storybook/react-vite';
import { type ReactNode, useEffect } from 'react';

import { en, ja, LabelsProvider } from '@/components/labels';
import { applyBacklogTheme, type BacklogTheme } from '@/lib/theme/backlogTheme';

import '@/components/tokens/tailwind.css';
import './preview.css';

type Theme = 'light' | 'dark';
type Locale = 'ja' | 'en';

/** ReactApp.css 1.84.0 の theme-orange（backlog-facts.md §7） */
const BACKLOG_THEMES: Record<string, BacklogTheme> = {
  orange: {
    scheme: 'light',
    variables: {
      '--defaultColorMain': '#ea733b',
      '--defaultColorAccent': '#de5514',
      '--defaultColorAccent-rgb': '222,85,20',
      '--defaultColorBase': '#f3e6e2',
      '--defaultColorBase-rgb': '243,230,226',
      '--defaultColorBase-2': '#f7ebe9',
      '--defaultColorLink': '#c14524',
      '--defaultColorSub-1': '#ECA08B',
      '--backgroundColorSchemeBase': '#ffffff',
    },
  },
  'orange-dark': {
    scheme: 'dark',
    variables: {
      '--defaultColorMain': '#d4642f',
      '--defaultColorAccent': '#C3542D',
      '--defaultColorAccent-rgb': '210,93,60',
      '--defaultColorBase': '#3e3e3e',
      '--defaultColorBase-rgb': '62,62,62',
      '--defaultColorBase-2': '#333333',
      '--defaultColorLink': '#ff9454',
      '--defaultColorSub-1': '#ECA08B',
      '--backgroundColorSchemeBase': '#333333',
    },
  },
};

function resolveWidth(value: unknown): number | undefined {
  switch (value) {
    case '360':
      return 360;
    case '640':
      return 640;
    case '720':
      return 720;
    default:
      return undefined;
  }
}

function StoryFrame({
  theme,
  backlogTheme,
  locale,
  width,
  children,
}: {
  theme: Theme;
  backlogTheme: BacklogTheme | undefined;
  locale: Locale;
  width: number | undefined;
  children: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.dataset.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    applyBacklogTheme(document.documentElement, backlogTheme);
  }, [backlogTheme]);

  return (
    <LabelsProvider labels={locale === 'en' ? en : ja}>
      <div
        data-color-scheme={theme}
        className="@container font-body text-default"
        style={{ width }}
      >
        {children}
      </div>
    </LabelsProvider>
  );
}

const withFrame: Decorator = (Story, { globals }) => (
  <StoryFrame
    theme={globals.theme === 'dark' ? 'dark' : 'light'}
    backlogTheme={BACKLOG_THEMES[String(globals.backlogTheme)]}
    locale={globals.locale === 'en' ? 'en' : 'ja'}
    width={resolveWidth(globals.width)}
  >
    <Story />
  </StoryFrame>
);

const preview: Preview = {
  globalTypes: {
    theme: {
      description: '配色',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    backlogTheme: {
      description: 'Backlog のプロジェクトテーマ',
      toolbar: {
        title: 'Project theme',
        icon: 'paintbrush',
        items: [
          { value: 'none', title: 'なし（既定の配色）' },
          { value: 'orange', title: 'theme-orange' },
          { value: 'orange-dark', title: 'theme-orange（ダークモード）' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: '文言の辞書',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'ja', title: '日本語' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
    width: {
      description: 'ラッパーの幅',
      toolbar: {
        title: 'Width',
        icon: 'ruler',
        items: [
          { value: 'auto', title: 'Auto' },
          { value: '360', title: '360px' },
          { value: '640', title: '640px' },
          { value: '720', title: '720px' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light', backlogTheme: 'none', locale: 'ja', width: 'auto' },
  decorators: [withFrame],
  parameters: {
    backgrounds: { disable: true },
    controls: {
      matchers: { color: /(background|color)$/iu, date: /Date$/iu },
    },
  },
};

export default preview;
