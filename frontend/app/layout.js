import './globals.css';
import Providers from './providers';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'AutoApplyAI — Interview Prep & Job Tools',
  description: 'AI-powered mock interviews, aptitude tests, and job application tools.',
  themeColor: '#0F1117',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning={true}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}