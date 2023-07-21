import { Metadata } from 'next';
import './app.scss';

export const metadata: Metadata = {
  title: 'Luigi Espinosa | Frontend web developer',
  description: 'Número Cuatro Portfolio',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>{children}</body>
    </html>
  );
}
