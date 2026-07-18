import type { Metadata } from "next";
import { PublicMarketplaceShell } from "@/src/components/marketplace/public-marketplace-shell";
import { VendorMarketplaceDirectory, type MarketplaceDirectoryParams } from "@/src/components/marketplace/vendor-marketplace-directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Local Vendor Marketplace",
  description: "Browse paid, approved, active Optimize Local Connect Founding Partners by service category and service area.",
  alternates: { canonical: "/marketplace" },
  openGraph: { title: "Optimize Local Connect Vendor Marketplace", description: "Find approved local home-service Founding Partners and contact them directly.", url: "/marketplace", type: "website" },
};

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<MarketplaceDirectoryParams> }) {
  return <PublicMarketplaceShell><VendorMarketplaceDirectory params={await searchParams} /></PublicMarketplaceShell>;
}
