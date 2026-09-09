import type { Decorator, Preview } from '@storybook/react-vite';
import '../src/tokens/tokens.css';

/**
 * パレットは Backlog のページに重なる（P7）。背景をページ相当の面にしておかないと、
 * 影と暗転で層が読めているかを Storybook 上で判断できない。
 */
const withSurface: Decorator = (Story, context) => (
  <div
    data-bp-theme=""
    data-bp-scheme={context.globals.scheme}
    style={{
      padding: 24,
      background: context.globals.scheme === 'dark' ? '#17161d' : '#f4f4f6',
      fontFamily: 'var(--bp-font-body)',
    }}
  >
    <Story />
  </div>
);

const preview: Preview = {
  decorators: [withSurface],
  initialGlobals: { scheme: 'light' },
  globalTypes: {
    scheme: {
      description: 'カラースキーム',
      toolbar: {
        title: 'Scheme',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
  },
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
  },
};

export default preview;
