import type { Meta, StoryObj } from '@storybook/react';

import { Container } from './Container';
import { ComingSoon } from '../ComingSoon/ComingSoon';

const meta: Meta<typeof Container> = {
  title: 'Atoms/Container',
  component: Container,
  argTypes: {
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Content: Story = {
  render: ({ ...args }) => <Container {...args}>{args.children}</Container>,
};

Content.args = {
  children: <ComingSoon />,
  className: 'custom-class',
};
