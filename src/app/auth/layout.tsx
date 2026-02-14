export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-primary">Alterna</span> Pick
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Predict. Compete. Dominate.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
