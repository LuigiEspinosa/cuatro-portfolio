import type { Meta, StoryObj } from '@storybook/react';

import Celeste from './Celeste';

const meta: Meta<typeof Celeste> = {
  component: Celeste,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof Celeste>;

export const Primary: Story = {
  render: () => <Celeste />,
};
