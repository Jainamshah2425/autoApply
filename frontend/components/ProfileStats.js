'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfileStats({ stats = {} }) {
  const {
    totalInterviews = 0,
    totalQuestions = 0,
    averageScore = 0,
    favoriteTopics = [],
    weeklyGoal = 5,
    weeklyProgress = 0,
    currentStreak = 0,
  } = stats;

  const weeklyPercent = Math.min((weeklyProgress / weeklyGoal) * 100, 100);

  const statCards = [
    { title: 'Interviews', value: totalInterviews },
    { title: 'Questions', value: totalQuestions },
    { title: 'Avg score', value: `${averageScore}%` },
    { title: 'Streak', value: `${currentStreak}d` },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Weekly goal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">{weeklyProgress} / {weeklyGoal} sessions</p>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${weeklyPercent}%` }} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-6">
              <p className="text-2xl font-medium text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {favoriteTopics.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Favorite topics</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {favoriteTopics.map((topic, index) => (
              <span key={index} className="px-3 py-1 rounded-full text-sm border border-border bg-muted text-foreground">
                {topic.name} ({topic.count})
              </span>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
