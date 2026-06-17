import { AlertCircle } from "lucide-react";

export function ErrorMessage({ title, message, className = "" }) {
  if (!title && !message) return null;

  return (
    <div className={`p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive flex items-start gap-3 ${className}`}>
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div>
        {title && <h3 className="font-semibold">{title}</h3>}
        {message && <p className="text-sm">{message}</p>}
      </div>
    </div>
  );
}
