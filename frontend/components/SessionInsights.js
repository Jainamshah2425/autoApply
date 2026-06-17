import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SessionInsights({ insights }) {
  if (!insights) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">No session insights available.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        {insights.overallAssessment && <p>{insights.overallAssessment}</p>}
        {insights.strengths?.length > 0 && (
          <div>
            <p className="font-medium text-foreground mb-1">Strengths</p>
            <ul className="list-disc pl-5 space-y-1">
              {insights.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
        {insights.improvements?.length > 0 && (
          <div>
            <p className="font-medium text-foreground mb-1">Improvements</p>
            <ul className="list-disc pl-5 space-y-1">
              {insights.improvements.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
