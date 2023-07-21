import type { Meta, StoryObj } from '@storybook/react';

import { Navbar } from './Navbar';

const meta: Meta<typeof Navbar> = {
  title: 'Atoms/Navbar',
  component: Navbar,
  argTypes: {},
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Simple: Story = {
  render: () => <Navbar />,
};
