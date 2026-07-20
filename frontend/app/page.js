'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import Header from '../components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, BarChart3, Briefcase, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Mic,
    title: 'AI Interview',
    description: 'Practice with per-answer feedback, or simulate live behavioral and technical interviews.',
    href: '/interview',
  },
  {
    icon: BarChart3,
    title: 'Aptitude Tests',
    description: 'Timed quant, logical, and verbal practice with topic-wise breakdown.',
    href: '/aptitude',
  },
  {
    icon: Briefcase,
    title: 'Job Search',
    description: 'Discover internships, generate cover letters, and send applications via Gmail.',
    href: '/dashboard',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl mb-4">
            Prepare smarter. Interview better.
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            AI-powered mock interviews, aptitude tests, and job application tools for your next role.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/interview">Get started <ArrowRight className="w-4 h-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" onClick={() => signIn('google')}>
              Sign in with Google
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {features.map((f) => (
            <Link key={f.href} href={f.href}>
              <Card className="h-full hover:border-primary/30 transition-colors">
                <CardHeader>
                  <f.icon className="w-6 h-6 text-primary mb-2" />
                  <CardTitle className="text-xl">{f.title}</CardTitle>
                  <CardDescription>{f.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-primary inline-flex items-center gap-1">
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
