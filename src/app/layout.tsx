import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AchievementProvider } from "@/components/achievement-provider";
import { AuthProvider } from "@/components/auth-provider";
import { GuestProvider } from "@/contexts/guest-context";
import { SearchProvider } from "@/contexts/search-context";
import { UserProvider } from "@/contexts/user-context";
import { ToastNotification } from "@/components/notifications/NotificationToast";
import { SparkCollaborationProvider } from "@/components/collaborative/presence-provider";
import { getSocket } from "@/lib/socket-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spark - Visual Idea Evolution Platform",
  description: "Nurture concepts from initial inspiration to completion with gamified, visual interaction and AI integration.",
  keywords: ["Spark", "ideas", "visual", "gamification", "AI", "development", "creativity"],
  authors: [{ name: "Spark Team" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Spark",
  },
  openGraph: {
    title: "Spark - Visual Idea Evolution Platform",
    description: "Nurture concepts from initial inspiration to completion with gamified, visual interaction",
    url: "https://spark.z.ai",
    siteName: "Spark",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spark - Visual Idea Evolution Platform",
    description: "Nurture concepts from initial inspiration to completion with gamified, visual interaction",
  },
};

export function generateViewport() {
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: '#3b82f6',
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Spark" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('ServiceWorker registration successful with scope: ', registration.scope);
                      
                      // Check for updates
                      registration.addEventListener('updatefound', function() {
                        console.log('ServiceWorker update found');
                        const installingWorker = registration.installing;
                        if (installingWorker) {
                          installingWorker.addEventListener('statechange', function() {
                            if (installingWorker.state === 'installed') {
                              if (navigator.serviceWorker.controller) {
                                console.log('New content available, refresh to update');
                                // Optionally show update notification to user
                              }
                            }
                          });
                        }
                      });
                    })
                    .catch(function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <GuestProvider>
          <AuthProvider>
            <UserProvider>
              <SearchProvider>
                <SparkCollaborationProvider socket={getSocket()}>
                  <AchievementProvider>
                    {children}
                    <Toaster />
                    <ToastNotification useIntegratedToast={true} />
                  </AchievementProvider>
                </SparkCollaborationProvider>
              </SearchProvider>
            </UserProvider>
          </AuthProvider>
        </GuestProvider>
      </body>
    </html>
  );
}