import type { Meta, StoryObj } from '@storybook/react';

import { Header } from './Header';

const meta: Meta<typeof Header> = {
  title: 'Molecules/Header',
  component: Header,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Simple: Story = {
  render: () => <Header />,
};
