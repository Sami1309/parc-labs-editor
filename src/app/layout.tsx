import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { trackIp } from "@/lib/ip-tracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Video Researcher",
  description: "Agentic research tool for video creators",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Track IP on initial load
  const headersList = await headers();
  // On Render, the real IP is in x-forwarded-for.
  // It might be a comma-separated list; the first one is the client.
  const forwardedFor = headersList.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
  
  // Fire and forget tracking (don't block render too much, though node is single threaded so sync FS will block)
  // Since trackIp is async but implementation uses sync FS, it's safer to await it or at least call it.
  await trackIp(ip);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
