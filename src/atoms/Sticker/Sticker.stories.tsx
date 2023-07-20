import type { Meta, StoryObj } from '@storybook/react';

import { Sticker } from './Sticker';

const meta: Meta<typeof Sticker> = {
  title: 'Atoms/Sticker',
  component: Sticker,
  tags: ['autodocs'],
  argTypes: {},
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  render: () => <Sticker />,
};
