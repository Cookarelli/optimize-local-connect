import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/src/components/providers/query-provider";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Optimize Local Property OS", template: "%s | Property OS" },
  description: "Save time, save money, and simplify property management with trusted local vendors in one connected operating system.",
  applicationName: "Optimize Local Property OS",
  openGraph: {
    title: "Optimize Local Property OS",
    description: "Save time. Save money. Simplify property management.",
    type: "website",
    images: [{ url: "/og-v2.png", width: 1536, height: 1024, alt: "Optimize Local Property OS — Save time. Save money. Simplify property management." }],
  },
  twitter: { card: "summary_large_image", images: ["/og-v2.png"] },
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
