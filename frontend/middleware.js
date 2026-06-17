import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/' },
});

export const config = {
  matcher: ['/dashboard/:path*', '/interview/:path*', '/live-interview/:path*', '/aptitude/:path*', '/upload/:path*', '/profile/:path*'],
};
