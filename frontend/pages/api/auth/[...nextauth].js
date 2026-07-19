import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
// Render free tier cold starts often exceed 5s; keep this high enough to create/fetch the user.
const API_TIMEOUT = 45000;

async function syncUserWithBackend({ email, name, image }) {
  try {
    const res = await axios.get(
      `${API_URL}/api/user/by-email/${encodeURIComponent(email)}`,
      { timeout: API_TIMEOUT }
    );
    return res.data._id?.toString() || res.data.userId;
  } catch (error) {
    if (error.response?.status !== 404) {
      console.error('Failed to fetch user for OAuth:', error.message);
      return null;
    }
  }

  try {
    const createRes = await axios.post(
      `${API_URL}/api/user/create`,
      { email, name, image },
      { timeout: API_TIMEOUT }
    );
    return createRes.data._id?.toString() || createRes.data.userId;
  } catch (error) {
    console.error('Failed to create user for OAuth:', error.message);
    return null;
  }
}

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/',
    error: '/',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // On first sign-in, or if a prior cold-start sync failed, resolve Mongo user id.
      const email = user?.email || token.email;
      const name = user?.name || token.name;
      const image = user?.image || token.picture;
      if (email && (!token.userId || (account && user?.email))) {
        const userId = await syncUserWithBackend({ email, name, image });
        if (userId) token.userId = userId;
      }
      return token;
    },
    async session({ session, token }) {
      let userId = token.userId;
      // Last-chance sync for this session response if jwt still has no userId
      // (e.g. first login hit a cold backend; subsequent /api/auth/session can recover).
      if (!userId && session.user?.email) {
        userId = await syncUserWithBackend({
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
        });
      }

      if (userId && session.user && process.env.NEXTAUTH_SECRET) {
        session.user.id = userId;
        // Short-lived bearer token the frontend attaches to backend API calls,
        // signed with the same secret NextAuth already uses for its own JWT.
        session.accessToken = jwt.sign(
          { userId, email: session.user.email },
          process.env.NEXTAUTH_SECRET,
          { expiresIn: '1h' }
        );
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  debug: process.env.NODE_ENV === 'development',
});
