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
import { SparkCollaborationProvider } from "@/components/collaboration/presence-provider";
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
    icon: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  },
  themeColor: "#10b981",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
