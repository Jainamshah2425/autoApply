'use client';
import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function Header() {
  const { data: session } = useSession();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
      <Link href="/" className="text-xl font-bold">AutoApplyAI</Link>
      <nav className="space-x-4">
        <Link href="/upload">Upload</Link>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/interview">Interview</Link>
        
        {isMounted && session ? (
          <>
            <span className="text-sm">{session.user.email}</span>
            <button onClick={() => signOut()} className="bg-red-600 px-3 py-1 rounded">Logout</button>
          </>
        ) : (
          <button onClick={() => signIn('google')} className="bg-blue-600 px-3 py-1 rounded">Login</button>
        )}
      </nav>
    </header>
  );
}
