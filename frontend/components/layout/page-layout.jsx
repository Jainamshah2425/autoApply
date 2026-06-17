import Header from '@/components/header';

export default function PageLayout({ title, description, children, actions }) {
  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {(title || description || actions) && (
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {title && (
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
              )}
              {description && (
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
        )}
        {children}
      </main>
    </>
  );
}
