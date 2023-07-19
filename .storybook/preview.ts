import type { Preview } from '@storybook/react';
import { themes } from '@storybook/theming';
import '../src/app.scss';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      theme: themes.dark,
    },
    a11y: {
      element: '#storybook-root',
      config: {
        rules: [],
      },
      options: {},
      manual: true,
    },
  },
};

export default preview;
