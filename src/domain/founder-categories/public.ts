export type PublicFounderCategoryState = "available" | "reserved" | "claimed";

export type PublicFounderCategory = {
  name: string;
  slug: string;
  displayOrder: number;
  state: PublicFounderCategoryState;
  businessName: string | null;
};

export type PublicFounderCategoryAvailability = {
  categories: PublicFounderCategory[];
  available: PublicFounderCategory[];
  unavailable: boolean;
};
