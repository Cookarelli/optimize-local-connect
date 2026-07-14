export type VerticalStatus = "launch" | "active" | "planned";

export const SHARED_PLATFORM_MODULES = [
  "identity",
  "organizations",
  "geography",
  "provider_marketplace",
  "requests",
  "quotes",
  "work_execution",
  "communications",
  "files",
  "notifications",
  "analytics",
  "impact_engine",
  "optimize_ai",
] as const;

export type VerticalDefinition = {
  key: string;
  name: string;
  version: number | null;
  status: VerticalStatus;
  moduleKey: string;
  description: string;
  organizationTypes: readonly string[];
  capabilities: readonly string[];
  navigation: readonly { label: string; href: string }[];
};

export const PROPERTY_MANAGEMENT_VERTICAL = {
  key: "property_management",
  name: "Property Management",
  version: 1,
  status: "launch",
  moduleKey: "property_operations",
  description: "Local property operations connecting management teams, service providers, technicians, and future residents.",
  organizationTypes: ["property_management", "vendor"],
  capabilities: [
    ...SHARED_PLATFORM_MODULES,
    "properties",
    "work_orders",
    "invoices",
    "reviews",
    "warranties",
    "appliance_inventory",
  ],
  navigation: [
    { label: "Properties", href: "/properties" },
    { label: "Requests", href: "/requests" },
    { label: "Local Marketplace", href: "/marketplace" },
  ],
} as const satisfies VerticalDefinition;

function plannedVertical(definition: Pick<VerticalDefinition, "key" | "name" | "moduleKey" | "description" | "organizationTypes">): VerticalDefinition {
  return {
    ...definition,
    version: null,
    status: "planned",
    capabilities: [...SHARED_PLATFORM_MODULES, definition.moduleKey],
    navigation: [],
  };
}

export const VERTICAL_REGISTRY: Readonly<Record<string, VerticalDefinition>> = Object.fromEntries([
  PROPERTY_MANAGEMENT_VERTICAL,
  plannedVertical({ key: "hoas", name: "HOAs", moduleKey: "community_governance", description: "Community association governance, resident service coordination, and trusted local procurement.", organizationTypes: ["hoa", "vendor"] }),
  plannedVertical({ key: "homeowners", name: "Homeowners", moduleKey: "household_services", description: "Trusted local services and decision support for homeowners and their homes.", organizationTypes: ["homeowner", "vendor"] }),
  plannedVertical({ key: "realtors", name: "Realtors", moduleKey: "transaction_coordination", description: "Local service coordination and decision support around real-estate transactions.", organizationTypes: ["real_estate", "vendor"] }),
  plannedVertical({ key: "local_governments", name: "Local Governments", moduleKey: "civic_procurement", description: "Transparent local purchasing, service coordination, and measurable community impact.", organizationTypes: ["local_government", "vendor"] }),
  plannedVertical({ key: "schools", name: "Schools", moduleKey: "education_facilities", description: "Local service networks and accountable operations for education communities.", organizationTypes: ["school", "vendor"] }),
  plannedVertical({ key: "healthcare", name: "Healthcare", moduleKey: "healthcare_facilities", description: "Governed local service coordination for healthcare facilities and community providers.", organizationTypes: ["healthcare", "vendor"] }),
  plannedVertical({ key: "nonprofits", name: "Nonprofits", moduleKey: "nonprofit_operations", description: "Resource-efficient operations and local partnerships for mission-driven organizations.", organizationTypes: ["nonprofit", "vendor"] }),
  plannedVertical({ key: "service_marketplaces", name: "Service Marketplaces", moduleKey: "marketplace_operations", description: "Reusable local marketplace infrastructure for specialized service communities.", organizationTypes: ["service_marketplace", "vendor"] }),
].map((vertical) => [vertical.key, vertical]));

export function getVertical(key: string): VerticalDefinition | undefined {
  return VERTICAL_REGISTRY[key];
}
