'use client';

import { SessionProvider } from 'next-auth/react';

export default function Providers({ children }) {
  return (
    <SessionProvider
      // Reduce frequency of session checks to prevent hydration mismatches
      refetchInterval={5 * 60} // 5 minutes
      refetchOnWindowFocus={false}
    >
      {children}
    </SessionProvider>
  );
}