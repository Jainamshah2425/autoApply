'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function useUserId() {
  const { data: session, status } = useSession();
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user?.email) {
      setUserId(null);
      setLoading(false);
      return;
    }

    if (session.user.id) {
      setUserId(session.user.id);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchUser() {
      try {
        const res = await api.get(`/api/user/by-email/${session.user.email}`);
        if (!cancelled) {
          setUserId(res.data._id);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setUserId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUser();
    return () => { cancelled = true; };
  }, [session, status]);

  return { userId, loading: status === 'loading' || loading, error, session, status };
}
