import type { Meta, StoryObj } from '@storybook/react';

import { Marquee } from './Marquee';

const meta: Meta<typeof Marquee> = {
  title: 'Atoms/Marquee',
  component: Marquee,
  argTypes: {
    label: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Content: Story = {
  render: ({ ...args }) => <Marquee {...args} />,
};

Content.args = {
  label: 'Coming Soon! Numero Cuatro. Frontend Developer.',
};
