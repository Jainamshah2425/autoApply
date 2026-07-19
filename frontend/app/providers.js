'use client';

import { SessionProvider } from 'next-auth/react';
import SessionTokenSync from '../components/SessionTokenSync';

export default function Providers({ children }) {
  return (
    <SessionProvider
      // Reduce frequency of session checks to prevent hydration mismatches
      refetchInterval={5 * 60} // 5 minutes
      refetchOnWindowFocus={false}
    >
      <SessionTokenSync />
      {children}
    </SessionProvider>
  );
}