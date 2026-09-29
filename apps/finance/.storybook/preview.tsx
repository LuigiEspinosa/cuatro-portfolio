import "../app/globals.css";
import type { Preview } from "@storybook/nextjs-vite";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="dark bg-background text-foreground min-h-screen p-8">
        <Story />
      </div>
    ),
  ],
};

export default preview;
