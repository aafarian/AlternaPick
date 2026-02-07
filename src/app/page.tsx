import Link from "next/link";

const features = [
  {
    title: "Pick Over/Unders",
    description:
      "Browse tonight's NBA player props and lock in your predictions. Points, rebounds, assists, and more.",
    icon: "🎯",
  },
  {
    title: "Challenge Friends",
    description:
      "Go head-to-head with your friends. You both pick 6 — see who knows the game better.",
    icon: "⚔️",
  },
  {
    title: "Climb the Leaderboard",
    description:
      "Track your win rate, build streaks, and prove you're the best predictor in your crew.",
    icon: "🏆",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 py-20 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
          Predict. Compete.{" "}
          <span className="text-accent">Dominate.</span>
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Pick over/unders on real NBA player props, challenge your friends
          head-to-head, and see who really knows the game. No money — just
          bragging rights.
        </p>
        <div className="mt-4 flex gap-4">
          <Link
            href="/props"
            className="rounded-xl bg-accent px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Make Your Picks
          </Link>
          <Link
            href="/cards"
            className="rounded-xl border border-border px-6 py-3 text-lg font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            View My Cards
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid w-full max-w-4xl gap-6 py-12 sm:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:bg-surface-hover"
          >
            <div className="mb-3 text-3xl">{feature.icon}</div>
            <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
            <p className="text-sm text-muted">{feature.description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
