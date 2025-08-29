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
      <Link href="/" className="text-xl font-bold hover:text-blue-300 transition-colors">AutoApplyAI</Link>
      <nav className="space-x-4">
        <Link href="/" className="hover:text-blue-300 transition-colors">Home</Link>
        <Link href="/upload" className="hover:text-blue-300 transition-colors">Upload</Link>
        <Link href="/dashboard" className="hover:text-blue-300 transition-colors">Dashboard</Link>
        <Link href="/interview" className="hover:text-blue-300 transition-colors">Interview</Link>
        <Link href="/profile" className="hover:text-blue-300 transition-colors">Profile</Link>
        
      
        
        {isMounted && session ? (
          <>
            <span className="text-sm">{session.user.email}</span>
            <button onClick={() => signOut()} className="bg-red-600 px-3 py-1 rounded hover:bg-red-700 transition-colors">Logout</button>
          </>
        ) : (
          <button onClick={() => signIn('google')} className="bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 transition-colors">Login</button>
        )}
      </nav>
    </header>
  );
}
