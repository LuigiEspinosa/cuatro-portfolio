import type { Meta, StoryObj } from '@storybook/react';

import Intro from './Intro';

const meta: Meta<typeof Intro> = {
  title: 'Atoms/Intro',
  component: Intro,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Content: Story = {
  render: ({ ...args }) => <Intro {...args} />,
};
