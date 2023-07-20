import type { Meta, StoryObj } from '@storybook/react';

import { ComingSoon } from './ComingSoon';

const meta: Meta<typeof ComingSoon> = {
  title: 'Atoms/Coming Soon',
  component: ComingSoon,
  tags: ['autodocs'],
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Content: Story = {
  render: () => <ComingSoon />,
};
