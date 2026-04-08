import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/constants";
import Header from "@/components/layout/Header";
import NavigationProgress from "@/components/layout/NavigationProgress";
import Footer from "@/components/layout/Footer";
import BottomTabBar from "@/components/layout/BottomTabBar";
import { AuthProvider } from "@/lib/auth/auth-context";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { PlayerProfileProvider } from "@/lib/players/player-profile-context";
import PlayerProfileSheet from "@/components/players/PlayerProfileSheet";
import ServiceWorkerRegistration from "@/components/pwa/ServiceWorkerRegistration";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import PendingCardHandler from "@/components/cards/PendingCardHandler";
import PageTransitionShell from "@/components/layout/PageTransitionShell";
import { Toaster } from "sonner";
import { MAX_VISIBLE_TOASTS } from "@/lib/constants";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema, websiteSchema } from "@/lib/seo/structured-data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "AlternaPick - Predict. Compete. Dominate.",
  description:
    "Pick over/unders on real player props across NBA, college basketball, soccer, and more. Challenge friends head-to-head and climb the leaderboard. Free to play.",
  keywords: [
    "player props",
    "over under",
    "NBA predictions",
    "sports picks",
    "head to head",
    "free sports game",
    "basketball props",
    "soccer props",
    "college basketball",
    "leaderboard",
  ],
  openGraph: {
    title: "AlternaPick - Predict. Compete. Dominate.",
    description:
      "Pick over/unders on real player props across NBA, college basketball, soccer, and more. Challenge friends head-to-head and climb the leaderboard.",
    type: "website",
    siteName: "AlternaPick",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AlternaPick - Predict. Compete. Dominate.",
    description:
      "Pick over/unders on real player props. Challenge friends and climb the leaderboard. Free to play.",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegistration />
        <ScrollToTop />
        <AuthProvider>
          <NavigationProgress />
          <PendingCardHandler />
          <OnboardingProvider>
            <PlayerProfileProvider>
            <Header />
            <main className="mx-auto min-h-screen max-w-6xl px-4 pt-20 pb-20 md:pb-12">
              <PageTransitionShell>
                {children}
              </PageTransitionShell>
            </main>
            <Footer />
            <BottomTabBar />
            <PlayerProfileSheet />
            <Toaster
              position="top-right"
              offset={72}
              duration={5000}
              visibleToasts={MAX_VISIBLE_TOASTS}
              toastOptions={{
                style: {
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                  border: "1px solid hsl(var(--border))",
                },
              }}
            />
            </PlayerProfileProvider>
          </OnboardingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
