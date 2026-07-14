export const FOUNDING_SEAT_STATUSES = [
  "available",
  "pending_payment",
  "claimed",
  "reserved",
  "disabled",
] as const;

export type FoundingSeatStatus = (typeof FOUNDING_SEAT_STATUSES)[number];

export type FoundingProgram = {
  id: string;
  name: string;
  slug: string;
  totalSeats: number;
  priceCents: number;
  currency: string;
  holdMinutes: number;
};

export type FoundingSeat = {
  id: string;
  verticalId: string;
  seatNumber: number;
  status: FoundingSeatStatus;
  businessName: string | null;
  city: string | null;
  logoUrl: string | null;
  holdExpiresAt: string | null;
};

export type FoundingVertical = {
  id: string;
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  seats: FoundingSeat[];
};

export type FoundingBenefit = {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
};

export type FoundingBoard = {
  isLive: boolean;
  program: FoundingProgram;
  verticals: FoundingVertical[];
  benefits: FoundingBenefit[];
  claimedCount: number;
  unavailableCount: number;
};
