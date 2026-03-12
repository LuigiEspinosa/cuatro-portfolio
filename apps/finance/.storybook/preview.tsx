import type { Preview } from "@storybook/nextjs-vite";

const preview: Preview = {
  decorators: [
    (Story) => (
      <div className="dark bg-background min-h-screen p-8">
        <Story />
      </div>
    ),
  ],
};

export default preview;
