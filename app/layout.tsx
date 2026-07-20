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
  title: { default: PLATFORM_BRAND.productName, template: `%s | ${PLATFORM_BRAND.shortName}` },
  description: "Optimize Local Connect is the flagship AI-powered community platform for trusted local decisions, launching first with property management.",
  keywords: ["Optimize Local Connect", "local business marketplace", "property management platform", "trusted local vendors", "community impact"],
  applicationName: PLATFORM_BRAND.productName,
  openGraph: {
    title: PLATFORM_BRAND.productName,
    description: "Save time. Save money. Strengthen communities with trusted local businesses and simpler property operations.",
    type: "website",
    images: [{ url: "/og-company.png", width: 1536, height: 1024, alt: `${PLATFORM_BRAND.parentName} — Technology should make communities stronger.` }],
  },
  twitter: { card: "summary_large_image", images: ["/og-company.png"] },
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
