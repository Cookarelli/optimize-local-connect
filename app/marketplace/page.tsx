import type { Metadata } from "next";
import { PublicMarketplaceShell } from "@/src/components/marketplace/public-marketplace-shell";
import { VendorMarketplaceDirectory, type MarketplaceDirectoryParams } from "@/src/components/marketplace/vendor-marketplace-directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Local Business Network",
  description: "Explore approved, active local business profiles by category and service area in the Optimize Local Connect network.",
  alternates: { canonical: "/marketplace" },
  openGraph: { title: "Explore the Optimize Local Connect Network", description: "Find approved local businesses by service and location, review business-provided details, and contact them directly.", url: "/marketplace", type: "website" },
};

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<MarketplaceDirectoryParams> }) {
  return <PublicMarketplaceShell><VendorMarketplaceDirectory params={await searchParams} /></PublicMarketplaceShell>;
}
