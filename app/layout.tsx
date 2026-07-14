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
  description: "The local property management operating system connecting property teams with verified local vendors.",
  applicationName: "Optimize Local Property OS",
  openGraph: {
    title: "Optimize Local Property OS",
    description: "Every property. Every vendor. One calm workspace.",
    type: "website",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "Optimize Local Property OS — Less chasing. More resolved." }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
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
