import { Metadata } from 'next';
import './app.scss';

import { Header } from '@/components/molecules/Header/Header';
import { Body } from '@/components/atoms/Container/Container';

export const metadata: Metadata = {
  title: 'Luigi Espinosa | Frontend web developer',
  description: 'Número Cuatro Portfolio',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <Body>
        <Header />
        {children}
      </Body>
    </html>
  );
}
