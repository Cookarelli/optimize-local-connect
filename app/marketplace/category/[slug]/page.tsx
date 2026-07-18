import type { Metadata } from "next";
import { PublicMarketplaceShell } from "@/src/components/marketplace/public-marketplace-shell";
import { VendorMarketplaceDirectory, type MarketplaceDirectoryParams } from "@/src/components/marketplace/vendor-marketplace-directory";
import { parsePublicMarketplaceFilters } from "@/src/domain/vendor-memberships/marketplace";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<MarketplaceDirectoryParams> };
function fallbackName(slug: string) { return slug.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "); }

async function categoryName(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_public_founding_partner_filters");
  const filters = parsePublicMarketplaceFilters(data);
  return filters.categories.find(item => item.slug === slug)?.name ?? fallbackName(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { title: "Marketplace Category" };
  const name = await categoryName(slug);
  return { title: `${name} Providers`, description: `Browse approved Optimize Local Connect Founding Partners offering ${name.toLowerCase()} services in local communities.`, alternates: { canonical: `/marketplace/category/${slug}` }, openGraph: { title: `${name} Providers | Optimize Local Connect`, description: `Find active local ${name.toLowerCase()} providers and contact them directly.`, url: `/marketplace/category/${slug}`, type: "website" } };
}

export default async function MarketplaceCategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const safeSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "invalid-category";
  const name = await categoryName(safeSlug);
  return <PublicMarketplaceShell><VendorMarketplaceDirectory params={await searchParams} fixedCategory={safeSlug} fixedCategoryName={name} /></PublicMarketplaceShell>;
}
