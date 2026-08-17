import "server-only";
import type { PublicFounderCategoryAvailability } from "@/src/domain/founder-categories/public";
import { getPublicFounderCategories } from "@/src/lib/founder-categories/firestore";

export async function getPublicFounderCategoryAvailability(): Promise<PublicFounderCategoryAvailability> {
  try {
    const categories = await getPublicFounderCategories();
    if (categories.length !== 25) throw new Error("Founder category catalog is incomplete.");
    return { categories, available: categories.filter((category) => category.state === "available"), unavailable: false };
  } catch (error) {
    console.error("public_founder_categories_unavailable", { errorType: error instanceof Error ? error.name : "UnknownError" });
    // Fail closed: an unavailable category authority must never fall back to an
    // ungoverned Stripe Payment Link.
    return { categories: [], available: [], unavailable: true };
  }
}
