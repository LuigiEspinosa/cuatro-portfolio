import type { Preview } from '@storybook/react';
import { themes } from '@storybook/theming';
import { action } from '@storybook/addon-actions';
import { withPerformance } from 'storybook-addon-performance';

import '../src/app.scss';

const preview: Preview = {
  decorators: [withPerformance],
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
        rules: [
          {
            id: 'autocomplete-valid',
            selector: '*:not([autocomplete="nope"])',
          },
          {
            id: 'image-alt',
            enabled: false,
          },
        ],
      },
      options: {},
      manual: true,
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/',
        push(...args) {
          action('nextNavigation.push')(...args);
          return Promise.resolve(true);
        },
      },
    },
  },
};

export default preview;
