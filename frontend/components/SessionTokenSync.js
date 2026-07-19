'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { setAccessToken } from '@/lib/authToken';

// Mounted once near the root so the axios client (lib/api.js) always has the
// current session's access token available without calling getSession() on
// every request.
export default function SessionTokenSync() {
  const { data: session } = useSession();

  useEffect(() => {
    setAccessToken(session?.accessToken);
  }, [session?.accessToken]);

  return null;
}
