import type { FoundingBoard, FoundingBenefit, FoundingSeat, FoundingVertical } from "@/src/domain/founding-fifty/types";
import { FOUNDING_BENEFIT_CATALOG, FOUNDING_VERTICAL_CATALOG, INITIAL_RESERVED_SEATS } from "@/src/domain/founding-fifty/catalog";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function configured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getConfiguredLaunchBoard(): FoundingBoard {
  const seats: FoundingSeat[] = Array.from({ length: 50 }, (_, index) => {
    const seatNumber = index + 1;
    const businessName = INITIAL_RESERVED_SEATS[seatNumber] ?? null;
    return { id: `configuration-seat-${seatNumber}`, verticalId: `configuration-vertical-${Math.ceil(seatNumber / 2)}`, seatNumber, status: businessName ? "reserved" : "available", businessName, city: null, logoUrl: null, holdExpiresAt: null };
  });
  return {
    isLive: false,
    program: { id: "configuration", name: "The Founding Fifty", slug: "founding-fifty", totalSeats: 50, priceCents: 29900, currency: "USD", holdMinutes: 30 },
    verticals: FOUNDING_VERTICAL_CATALOG.map((name,index) => ({ id: `configuration-vertical-${index+1}`, name, slug: name.toLowerCase().replaceAll("&","and").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""), description: `Two permanent Founding Fifty seats for trusted local ${name.toLowerCase()} businesses.`, displayOrder: index+1, seats: seats.filter(seat=>seat.verticalId===`configuration-vertical-${index+1}`) })),
    benefits: FOUNDING_BENEFIT_CATALOG.map(([name,description],index)=>({id:`configuration-benefit-${index+1}`,name,description,displayOrder:index+1})),
    claimedCount: 0,
    unavailableCount: Object.keys(INITIAL_RESERVED_SEATS).length,
  };
}

export async function getFoundingBoard(): Promise<FoundingBoard> {
  if (!configured()) return getConfiguredLaunchBoard();
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("release_expired_founding_holds", { target_program_id: null });
  const { data: program, error: programError } = await supabase.from("founding_programs").select("id,name,slug,total_seats,price_cents,currency,hold_minutes").eq("slug", "founding-fifty").single();
  if (programError || !program) throw new Error("The Founding Fifty program is not available.");
  const [{ data: verticalRows, error: verticalError }, { data: seatRows, error: seatError }, { data: benefitRows, error: benefitError }] = await Promise.all([
    supabase.from("founding_verticals").select("id,name,slug,description,display_order").eq("program_id", program.id).eq("active", true).order("display_order"),
    supabase.from("founding_seats").select("id,vertical_id,seat_number,status,reserved_business_name,display_business_name,display_city,logo_url,hold_expires_at").eq("program_id", program.id).order("seat_number"),
    supabase.from("founding_benefits").select("id,name,description,display_order").eq("program_id", program.id).eq("active", true).order("display_order"),
  ]);
  if (verticalError || seatError || benefitError) throw new Error("Unable to load Founding Fifty availability.");
  const seats = (seatRows ?? []).map((seat): FoundingSeat => ({
    id: seat.id,
    verticalId: seat.vertical_id,
    seatNumber: seat.seat_number,
    status: seat.status,
    businessName: seat.display_business_name ?? seat.reserved_business_name,
    city: seat.display_city,
    logoUrl: seat.logo_url,
    holdExpiresAt: seat.hold_expires_at,
  }));
  const verticals = (verticalRows ?? []).map((vertical): FoundingVertical => ({
    id: vertical.id,
    name: vertical.name,
    slug: vertical.slug,
    description: vertical.description,
    displayOrder: vertical.display_order,
    seats: seats.filter((seat) => seat.verticalId === vertical.id),
  }));
  return {
    isLive: true,
    program: { id: program.id, name: program.name, slug: program.slug, totalSeats: program.total_seats, priceCents: program.price_cents, currency: program.currency, holdMinutes: program.hold_minutes },
    verticals,
    benefits: (benefitRows ?? []).map((benefit): FoundingBenefit => ({ id: benefit.id, name: benefit.name, description: benefit.description, displayOrder: benefit.display_order })),
    claimedCount: seats.filter((seat) => seat.status === "claimed").length,
    unavailableCount: seats.filter((seat) => seat.status !== "available").length,
  };
}

export function formatFoundingNumber(number: number) {
  return `#${number.toString().padStart(3, "0")}`;
}
