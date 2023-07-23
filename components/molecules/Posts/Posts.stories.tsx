import type { Meta, StoryObj } from '@storybook/react';

import Posts from './Posts';

const meta: Meta<typeof Posts> = {
  title: 'Molecules/Posts',
  component: Posts,
  argTypes: {},
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Simple: Story = {
  // render: () => <Posts />,
  render: () => (
    <h1 style={{ color: '#fff' }}>
      TODO: Hidden until fs issue is fixed.{' '}
      <a
        href='https://github.com/LuigiEspinosa/cuatro-portfolio/issues/4'
        target='_blank'
        style={{ color: '#fff' }}
      >
        https://github.com/LuigiEspinosa/cuatro-portfolio/issues/4
      </a>
    </h1>
  ),
};
