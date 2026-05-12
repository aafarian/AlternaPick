# AlternaPick

A free sports props prediction platform where users pick over/under on real player stats, track results with live scoring, wager in-app Flame Coins, and challenge friends.

**Live at [alternapick.com](https://alternapick.com)**

## Screenshots

### Browse Props
Pick over/under on player props across NBA, MLB, NCAAB, EPL, and La Liga. Player headshots, team logos, line movement tracking, and real-time lock countdowns.

<img width="100%" alt="Props page" src="https://github.com/user-attachments/assets/a5a3fc51-b173-4a0d-b92b-fb1e576645c7" />

### Live Scoring
Watch your picks resolve in real-time with animated progress bars, live game scores, and per-pick hit rate stats. Wager Flame Coins for multiplied payouts.

<img width="100%" alt="Live scoring" src="https://github.com/user-attachments/assets/121757d8-cb64-4910-a588-a88d6c8c5135" />

### Resolved Cards
See your finished cards with final scores, wager outcomes (multiplier + payout), and per-category hit rates.

<img width="100%" alt="Resolved cards" src="https://github.com/user-attachments/assets/bc1be8f3-4e52-4e83-bee1-21a0c49b8240" />

### Challenge Friends
Head-to-head matchups with multiple game modes (Classic, Sabotage, Mirror, Random). HeatScore tiebreaker system, emoji reactions, rematch flow.

<img width="100%" alt="Challenge matchup" src="https://github.com/user-attachments/assets/6879af77-6745-440b-891a-34b3f4a288b8" />

### Analytics Dashboard
D3-powered analytics with sport-tabbed category breakdowns, player podium, over/under donut chart, 30-day trend line, Flame Coin balance history, and more. Client-side filtering with animated transitions.

<img width="100%" alt="Analytics" src="https://github.com/user-attachments/assets/7cd7b0b2-b7e8-4413-9afd-dd8f3df9f0ec" />

### Weekly Wrapped
Spotify Wrapped-style weekly recaps with trend charts, player highlights, hot/cold streaks, and shareable cards.

<img width="100%" alt="Wrapped" src="https://github.com/user-attachments/assets/138f0c75-1976-4b88-a0e5-9cc962c9be3d" />

### Profile Customization
Custom profile icons with shape, color, border, and emblem selection.

<img width="100%" alt="Profile settings" src="https://github.com/user-attachments/assets/d5799ab8-27ba-4851-92c3-4d5cd6b807b8" />

## Features

- **Multi-sport props** across NBA, MLB, NCAAB, EPL, and La Liga with real odds data
- **Live scoring** with real-time game data, animated progress bars, and box scores
- **Flame Coin economy** with wagering, multiplier payouts, and balance tracking
- **Challenge system** with 6 game modes, HeatScore tiebreakers, and emoji reactions
- **Analytics dashboard** with D3 charts, sport-grouped categories, player podium, coin trends
- **Weekly Wrapped** recaps with personalized highlights and shareable cards
- **Notification system** with real-time delivery, email digests, and in-app toasts
- **Friends system** with friend requests, profile popovers, and social feed
- **Leaderboard** with multiple ranking dimensions (hit rate, streaks, Flame Coins)
- **Responsive design** optimized for desktop and mobile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Database | Supabase (PostgreSQL + Auth + Realtime + RLS) |
| Styling | Tailwind CSS v4 + Radix UI (shadcn) |
| Charts | D3.js (scales, shapes, time series) |
| Animation | Framer Motion |
| Email | Resend (transactional + digest emails) |
| Data | The Odds API (props), ESPN API (scores, rosters, box scores) |
| Stats Service | Python (FastAPI) for ESPN data aggregation |
| Testing | Vitest + Testing Library |
| Deployment | Cloudflare (CDN) + Hetzner Cloud (Docker containers) |
| CI/CD | GitHub Actions (typecheck + lint + test + Docker build) |

## Architecture

```
alternapick/
  src/
    app/                  # Next.js App Router pages + API routes
    components/           # React components (props, analytics, live, layout)
    lib/                  # Business logic, queries, utilities
      analytics/          # D3 chart utils, query layer, types
      cards/              # Card builder, resolution, live computation
      challenges/         # Challenge creation, resolution, live polling
      heatscore/          # HeatScore + Flame Coin wager system
      odds-api/           # The Odds API integration + caching
      sports/             # Multi-sport config registry
      stats-service/      # ESPN API client
      email/              # Email templates (React Email)
  services/
    stats-service/        # Python FastAPI for ESPN data (scores, rosters, box scores)
    cron/                 # Game sync + resolution cron jobs
  supabase/
    migrations/           # PostgreSQL migrations with RLS policies
```

## Getting Started

```bash
npm install
npm run dev
```

Requires a `.env.local` with Supabase credentials, The Odds API key, and Resend API key. See `.env.local.example` for the full list.
