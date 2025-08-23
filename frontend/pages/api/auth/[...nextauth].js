import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import axios from 'axios';

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }) {
      try {
        // Fetch user ID from your backend
        const res = await axios.get(`http://localhost:5000/api/user/by-email/${session.user.email}`);
        session.user.id = res.data._id || res.data.userId;
        console.log('Session callback - User ID set to:', session.user.id);
      } catch (error) {
        console.error('Failed to fetch user ID for session:', error.message);
        // If user doesn't exist, create them
        try {
          console.log('Creating new user for:', session.user.email);
          const createRes = await axios.post('http://localhost:5000/api/user/create', {
            email: session.user.email,
            name: session.user.name,
            image: session.user.image
          });
          session.user.id = createRes.data._id || createRes.data.userId;
          console.log('New user created with ID:', session.user.id);
        } catch (createError) {
          console.error('Failed to create user:', createError.message);
        }
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Log successful sign-in
      console.log('User signed in:', user.email);
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Ensure redirects go to the correct base URL
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    }
  },
  debug: process.env.NODE_ENV === 'development', // Enable debug logging in development
});
