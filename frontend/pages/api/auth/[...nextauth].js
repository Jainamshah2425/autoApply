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
  callbacks: {
    async session({ session }) {
      try {
        const res = await axios.get(`http://localhost:5000/api/user/by-email/${session.user.email}`);
        session.user.id = res.data._id;
      } catch (error) {
        console.error('Failed to fetch user ID for session:', error);
      }
      return session;
    },
  },
});
