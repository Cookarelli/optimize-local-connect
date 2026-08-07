import { FOUNDING_MEMBER_OFFER } from "@/src/domain/vendor-memberships/catalog";

export const FOUNDING_VENDOR_SPOT_CAPACITY = FOUNDING_MEMBER_OFFER.capacity;

export const FOUNDING_VENDOR_RESERVED_CATEGORIES = [
  "HVAC",
  "Electrician",
  "Appliance Repair",
] as const;

export const FOUNDING_VENDOR_SPOTS_RESERVED = FOUNDING_VENDOR_RESERVED_CATEGORIES.length;
export const FOUNDING_VENDOR_RESERVATION_SUMMARY = `${FOUNDING_MEMBER_OFFER.claimed} claimed. Only ${FOUNDING_MEMBER_OFFER.remaining} remaining.`;
