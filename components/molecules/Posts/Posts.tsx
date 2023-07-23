import { getSortedPostsData } from '@/lib/posts';
import './posts.scss';

import { Container } from '@/components/atoms/Container/Container';
import ListItem from '@/components/atoms/ListItem/ListItem';

export default function Posts() {
  const posts = getSortedPostsData();

  return (
    <Container className='posts-section'>
      <h1 className='blog-title'>
        My passion lies in creating outstanding outcomes that leave a lasting impact.
      </h1>

      <ul className='posts-list'>
        {posts.map((post) => (
          <ListItem key={post.id} post={post} />
        ))}
      </ul>
    </Container>
  );
}
