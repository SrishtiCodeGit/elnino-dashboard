import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FloatingMenu } from "@/components/FloatingMenu";
import { getLatestOni } from "@/lib/data";
import { fetchLiveOni } from "@/lib/liveOni";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "El Nino Financial Risk | Research Dashboard",
  description:
    "Real-time research dashboard tracking El Nino / ENSO cycles and their impact on US state economies and global financial markets.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const liveOni = await fetchLiveOni();
  const liveLatest = liveOni?.length ? liveOni[liveOni.length - 1] : null;
  const latest = liveLatest
    ? { value: liveLatest.ONI, phase: liveLatest.phase, date: liveLatest.date }
    : getLatestOni();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-text-primary">
        <FloatingMenu latestOni={latest} />
        {children}
      </body>
    </html>
  );
}
