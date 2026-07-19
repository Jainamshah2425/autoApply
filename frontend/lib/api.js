import axios from 'axios';
import { getSession } from 'next-auth/react';
import { getAccessToken, setAccessToken } from './authToken';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 120000,
});

api.interceptors.request.use(async (config) => {
  let token = getAccessToken();

  // SessionTokenSync fills the cache in useEffect; if a request races that
  // (or sync never minted a token until a later session refresh), pull it now.
  if (!token && typeof window !== 'undefined') {
    try {
      const session = await getSession();
      token = session?.accessToken || null;
      if (token) setAccessToken(token);
    } catch {
      // leave token null — backend will return 401
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback;
}
