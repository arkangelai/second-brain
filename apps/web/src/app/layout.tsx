import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Second Brain",
  description: "Local-first, AI-native knowledge management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable} ${plexMono.variable} dark`}
    >
      <body className="antialiased">
        {children}
        <Toaster
          richColors
          closeButton
          theme="dark"
          toastOptions={{
            className:
              "!border !border-stone-800/80 !bg-stone-950/90 !text-stone-200 !backdrop-blur",
          }}
        />
      </body>
    </html>
  );
}
