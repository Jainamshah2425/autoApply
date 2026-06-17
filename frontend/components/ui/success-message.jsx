import { CheckCircle2 } from 'lucide-react';

export function SuccessMessage({ title, message, className = '' }) {
  if (!title && !message) return null;

  return (
    <div className={`p-4 bg-primary/10 border border-primary/20 rounded-lg text-foreground flex items-start gap-3 ${className}`}>
      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
      <div>
        {title && <h3 className="font-semibold">{title}</h3>}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}
