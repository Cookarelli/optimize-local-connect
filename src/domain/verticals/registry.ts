export type VerticalStatus = "launch" | "active" | "planned";

export type VerticalDefinition = {
  key: string;
  name: string;
  status: VerticalStatus;
  description: string;
  organizationTypes: readonly string[];
  capabilities: readonly string[];
  navigation: readonly { label: string; href: string }[];
};

export const PROPERTY_MANAGEMENT_VERTICAL = {
  key: "property_management",
  name: "Property Management",
  status: "launch",
  description: "Local property operations connecting management teams, service providers, technicians, and future residents.",
  organizationTypes: ["property_management", "vendor"],
  capabilities: [
    "properties",
    "service_requests",
    "provider_marketplace",
    "quotes",
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

export const VERTICAL_REGISTRY: Readonly<Record<string, VerticalDefinition>> = {
  [PROPERTY_MANAGEMENT_VERTICAL.key]: PROPERTY_MANAGEMENT_VERTICAL,
};

export function getVertical(key: string): VerticalDefinition | undefined {
  return VERTICAL_REGISTRY[key];
}
