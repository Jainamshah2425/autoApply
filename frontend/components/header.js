'use client';
import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';

export default function Header() {
  const { data: session } = useSession();
  const [isMounted, setIsMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/interview', label: 'Interview' },
    { href: '/aptitude', label: 'Aptitude' },
    { href: '/system-design', label: 'System Design' },
    { href: '/upload', label: 'Upload' },
    { href: '/profile', label: 'Profile' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex justify-between items-center">
        <Link href="/" className="text-base font-semibold tracking-tight text-foreground">
          PrepPilot
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                pathname === link.href || (link.href === '/interview' && pathname.startsWith('/interview'))
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
          
          {isMounted && session ? (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                  {(session.user.name || session.user.email)?.[0]?.toUpperCase()}
                </div>
              )}
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => signOut()}>
                Log out
              </Button>
            </div>
          ) : (
            <div className="ml-4 pl-4 border-l border-border">
              <Button variant="default" size="sm" onClick={() => signIn('google')}>Sign in</Button>
            </div>
          )}
        </nav>

        {/* Mobile Menu Toggle */}
        <div className="flex lg:hidden items-center">
          <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {isMenuOpen && (
        <div className="lg:hidden border-t border-border bg-background p-4 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMenuOpen(false)}
              className={`text-sm font-medium px-3 py-2.5 rounded-lg transition-colors ${
                pathname === link.href || (link.href === '/interview' && pathname.startsWith('/interview'))
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 mt-2 border-t border-border">
            {isMounted && session ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {session.user.image ? (
                    <Image src={session.user.image} alt="" width={24} height={24} className="rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      {(session.user.name || session.user.email)?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-muted-foreground truncate max-w-[180px]">{session.user.email}</span>
                </div>
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { signOut(); setIsMenuOpen(false); }}>
                  Log out
                </Button>
              </div>
            ) : (
              <Button variant="default" className="w-full" onClick={() => { signIn('google'); setIsMenuOpen(false); }}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
