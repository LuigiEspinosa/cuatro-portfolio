import type { Metadata } from 'next';
import Error404 from '@/components/organisms/ErrorPage/Error404';

export const metadata: Metadata = {
  title: 'Page not Found',
  description: 'This page does not exists.',
  openGraph: {
    title: 'Projects | Luigi Espinosa',
    description: 'This page does not exists.',
  },
};

export default function NotFound() {
  return <Error404 />;
}
