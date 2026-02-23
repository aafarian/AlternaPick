import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "AlternaPick - Predict. Compete. Dominate.",
  description:
    "Pick over/unders on real player props across NBA, college basketball, soccer, and more. Challenge friends head-to-head and climb the leaderboard. Free to play.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
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
