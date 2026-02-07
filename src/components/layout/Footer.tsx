export default function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted">
        <p className="font-semibold">
          <span className="text-accent">Sports</span>Tower
        </p>
        <p className="mt-1">Built for NBA fans.</p>
        <p className="mt-1">
          &copy; {new Date().getFullYear()} SportsTower. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
