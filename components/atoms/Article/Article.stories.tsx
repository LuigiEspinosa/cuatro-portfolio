import type { Meta, StoryObj } from '@storybook/react';

import Article from './Article';

const meta: Meta<typeof Article> = {
  title: 'Atoms/Article',
  component: Article,
  argTypes: {
    title: { control: 'text' },
    date: { control: 'text' },
    contentHTML: { control: 'text' },
  },
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Content: Story = {
  render: ({ ...args }) => <Article {...args} />,
};

Content.args = {
  title: 'Who Am I',
  date: 'July 21, 2023',
  contentHTML:
    "<h2>Embracing the Code: A Self-Taught Developer</h2><p>Hello, I am a self-taught front-end developer, fueled by an unwavering passion for code. I believe that the best way to truly understand and appreciate the art of coding is by sharing our experiences, learning from other, and collaborating to create impactful products.</p><hr><p><em>Message me at <a href='https://www.linkedin.com/in/luigiespinosa'>LinkedIn</a> if you'd like to connect or have any questions. Let's learn and grow together!</em></p>",
};
