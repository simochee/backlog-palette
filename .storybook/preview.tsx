import type { Decorator, Preview } from '@storybook/react-vite';
import { type ReactNode, useEffect } from 'react';

import { en, ja, LabelsProvider } from '@/components/labels';
import '@/components/tokens/tailwind.css';
import './preview.css';

type Theme = 'light' | 'dark';
type Locale = 'ja' | 'en';

const widths = { auto: undefined, '360': 360, '640': 640, '720': 720 } as const;
type WidthKey = keyof typeof widths;

function StoryFrame({
  theme,
  locale,
  width,
  children,
}: {
  theme: Theme;
  locale: Locale;
  width: number | undefined;
  children: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.dataset.colorScheme = theme;
  }, [theme]);

  return (
    <LabelsProvider labels={locale === 'en' ? en : ja}>
      <div data-color-scheme={theme} className="@container font-body text-default" style={{ width }}>
        {children}
      </div>
    </LabelsProvider>
  );
}

const withFrame: Decorator = (Story, { globals }) => (
  <StoryFrame
    theme={globals.theme === 'dark' ? 'dark' : 'light'}
    locale={globals.locale === 'en' ? 'en' : 'ja'}
    width={widths[(globals.width as WidthKey | undefined) ?? 'auto']}
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
  initialGlobals: { theme: 'light', locale: 'ja', width: 'auto' },
  decorators: [withFrame],
  parameters: {
    backgrounds: { disable: true },
    controls: {
      matchers: { color: /(background|color)$/iu, date: /Date$/iu },
    },
  },
};

export default preview;
