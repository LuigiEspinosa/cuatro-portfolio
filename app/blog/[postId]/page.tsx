import { notFound } from 'next/navigation';
import Article from '@/components/atoms/Article/Article';

import getFormattedDate from '@/lib/getFormattedDate';
import { getPostsData, getSortedPostsData } from '@/lib/posts';

interface PostProps {
  params: {
    postId: string;
  };
}

export function generateStaticParams() {
  const posts = getSortedPostsData();

  return posts.map((post) => ({
    postsId: post.id,
  }));
}

export async function generateMetadata({ params }: PostProps) {
  const posts = getSortedPostsData();
  const { postId } = params;

  const post = posts.find((post) => post.id === postId);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  return {
    title: post?.title,
  };
}

export default async function Post({ params }: PostProps) {
  const posts = getSortedPostsData();
  const { postId } = params;

  const post = posts.find((post) => post.id === postId);

  if (!post) {
    return notFound();
  }

  const { title, date, contentHTML } = await getPostsData(postId);
  const pubDate = getFormattedDate(date);

  return <Article title={title} date={pubDate} contentHTML={contentHTML} />;
}
