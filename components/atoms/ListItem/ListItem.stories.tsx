import type { Meta, StoryObj } from '@storybook/react';

import { Container } from '../Container/Container';
import ListItem from './ListItem';

const meta: Meta<typeof ListItem> = {
  title: 'Atoms/ListItem',
  component: ListItem,
  argTypes: {
    post: {
      id: 'text',
      cover: 'text',
      coverAlt: 'text',
      logo: 'text',
      logoAlt: 'text',
      date: 'text',
      title: 'text',
    },
  },
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Content: Story = {
  render: ({ ...args }) => (
    <Container className='posts-section'>
      <ul className='posts-list'>
        <ListItem {...args} />
      </ul>
    </Container>
  ),
};

Content.args = {
  post: {
    id: '01',
    title: 'Who Am I',
    date: '2023-07-22',
    cover: '/blog/who-am-i/cover.png',
    coverAlt: 'Renaissance Portrait AI Generated of a male with a Laptop',
    logo: '/blog/who-am-i/logo.png',
    logoAlt: "Numero Cuatro's Logo",
  },
};
