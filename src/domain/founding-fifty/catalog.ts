export const FOUNDING_VERTICAL_CATALOG = [
  "Roofing, Gutters & Siding", "Appliance Sales & Repair", "Cleaning Services", "HVAC", "Plumbing",
  "Electrical", "General Contracting", "Landscaping & Lawn Care", "Pest Control", "Painting",
  "Flooring & Carpet", "Restoration & Remediation", "Locksmith & Access Control", "Garage Doors & Gates", "Windows & Glass",
  "Pool & Spa Services", "Security & Low Voltage", "Moving & Junk Removal", "Waste & Recycling", "Tree Services",
  "Concrete & Masonry", "Fencing", "Handyman & Maintenance", "Real Estate Services", "Professional Business Services",
] as const;

export const FOUNDING_BENEFIT_CATALOG = [
  ["12 Months Premium", "The first twelve months of Premium membership are included."],
  ["Permanent Founding Fifty Badge", "A permanent badge recognizing the business as one of the original fifty."],
  ["Permanent Founding Number", "A unique number from #001 through #050 that remains with the confirmed business."],
  ["Locked Preferred Renewal Pricing", "Preferred renewal pricing is locked after the included first year."],
  ["Early Feature Voting", "Participate in structured voting on selected early platform capabilities."],
  ["Quarterly Founder Roundtables", "Invitation to quarterly conversations with the founder and cohort."],
  ["Founding Fifty Wall Placement", "Permanent recognition on the Founding Fifty wall."],
  ["Community Spotlight Eligibility", "Eligibility for community and business spotlight features."],
  ["Premium Profile Visibility", "A richer profile presence across the local marketplace, subject to published placement rules."],
  ["Optimize AI Eligibility", "Eligible providers may be considered by Optimize AI when verified, qualified, and relevant to a request."],
] as const;

export const INITIAL_RESERVED_SEATS: Readonly<Record<number, string>> = {
  1: "CLA Exteriors",
  3: "Afrodita Appliances",
  5: "Clean to a T",
};
