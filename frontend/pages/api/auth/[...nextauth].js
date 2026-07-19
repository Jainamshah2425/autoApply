import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_TIMEOUT = 5000;

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
      if (account && user?.email) {
        const userId = await syncUserWithBackend({
          email: user.email,
          name: user.name,
          image: user.image,
        });
        if (userId) token.userId = userId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId;
        // Short-lived bearer token the frontend attaches to backend API calls,
        // signed with the same secret NextAuth already uses for its own JWT.
        session.accessToken = jwt.sign(
          { userId: token.userId, email: session.user.email },
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
