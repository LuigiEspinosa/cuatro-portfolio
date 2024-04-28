import { Metadata } from 'next';
import CelesteComponent from '@/components/organisms/Celeste/Celeste';

export const metadata: Metadata = {
  title: 'I Love U <3',
};

export default function Celeste() {
  return <CelesteComponent />;
}

