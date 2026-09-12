import type { Preview } from '@storybook/react-vite';
import { fakeBrowser } from '#imports';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
  },
  beforeEach: () => {
    fakeBrowser.reset();
  },
};

export default preview;
