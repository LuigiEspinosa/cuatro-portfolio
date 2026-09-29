import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.tsx"],
  addons: [],
  framework: "@storybook/nextjs-vite",
  staticDirs: ["../public"],
  core: {
    disableTelemetry: true,
  },
};
export default config;
