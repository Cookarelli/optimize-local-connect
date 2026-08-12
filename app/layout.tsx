import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/src/components/providers/query-provider";
import { PLATFORM_BRAND } from "@/src/domain/platform/brand";
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
  metadataBase: process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : undefined,
  title: { default: "Optimize Local Connect | Intelligent Local Business Network", template: `%s | ${PLATFORM_BRAND.shortName}` },
  description: PLATFORM_BRAND.description,
  keywords: ["Optimize Local Connect", "local business network", "trusted local businesses", "member benefits", "local referrals", "property management vendors"],
  applicationName: PLATFORM_BRAND.productName,
  openGraph: {
    title: "Optimize Local Connect | Intelligent Local Business Network",
    description: PLATFORM_BRAND.description,
    type: "website",
    images: [{ url: "/og-network-v2.png", width: 1731, height: 909, alt: `${PLATFORM_BRAND.productName} — an intelligent local business network.` }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Optimize Local Connect | Intelligent Local Business Network",
    description: PLATFORM_BRAND.description,
    images: ["/og-network-v2.png"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
