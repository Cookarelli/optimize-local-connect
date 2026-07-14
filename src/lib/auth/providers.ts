export const AUTH_PROVIDERS = [
  { id: "google", label: "Google", enabled: true },
  { id: "azure", label: "Microsoft", enabled: false },
  { id: "apple", label: "Apple", enabled: false },
] as const;

export type AuthProviderId = (typeof AUTH_PROVIDERS)[number]["id"];
