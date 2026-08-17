import type { Timestamp } from "firebase-admin/firestore";
import type { VendorPlanKey, VendorMembershipStatus } from "@/src/domain/vendor-memberships/catalog";

export const ORGANIZATION_TYPES = ["property_manager", "vendor"] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];
export const ORGANIZATION_STATUSES = ["pending", "active", "suspended"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const ORGANIZATION_ROLES = ["owner", "admin", "manager", "staff", "vendor", "technician"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type OrganizationDocument = {
  type: OrganizationType;
  status: OrganizationStatus;
  name: string;
  normalizedName: string;
  slug: string;
  legalName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  websiteUrl: string | null;
  activeMembershipId: string | null;
  pendingMembershipId: string | null;
  legacyIds?: Record<string, string>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type OrganizationMembershipDocument = {
  organizationId: string;
  userId: string;
  organizationType: OrganizationType;
  role: OrganizationRole;
  status: "invited" | "active" | "suspended" | "removed";
  invitedAt: Timestamp | null;
  acceptedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type CommercialMembershipDocument = {
  organizationId: string;
  tier: VendorPlanKey;
  priority: 10 | 20 | 30;
  status: VendorMembershipStatus;
  categorySlug: string | null;
  paymentSource: "stripe" | "stripe_paid" | "paypal_paid" | "manually_granted" | null;
  listPriceCents: number;
  actualAmountPaidCents: number | null;
  currency: "USD";
  stripe: {
    customerId: string;
    checkoutSessionId: string | null;
    subscriptionId: string | null;
    priceId: string | null;
  } | null;
  paypal: { referenceId: string } | null;
  currentPeriodEndsAt: Timestamp | null;
  cancelAtPeriodEnd: boolean;
  checkoutAttemptNumber: number;
  entitlementsVersion: number;
  entitlementSnapshot: Record<string, boolean>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type PropertyDocument = {
  organizationId: string;
  name: string;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    stateCode: string;
    postalCode: string;
  };
  serviceAreaKey: string;
  status: "active" | "inactive";
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ServiceRequestAssignmentDocument = {
  requestId: string;
  propertyManagerOrganizationId: string;
  vendorOrganizationId: string;
  vendorName: string;
  categorySlug: string;
  serviceAreaKey: string;
  status: "assigned" | "accepted" | "declined" | "revoked";
  assignedBy: string;
  assignedAt: Timestamp;
  respondedAt: Timestamp | null;
  responseNote: string | null;
  revokedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ServiceRequestEventDocument = {
  type: string;
  status: ServiceRequestStatus;
  actorUserId: string;
  actorOrganizationId: string | null;
  note: string | null;
  vendorVisible: boolean;
  createdAt: Timestamp;
};

export type PublicMarketplaceVendorDocument = {
  organizationId: string;
  businessName: string;
  membershipPriority: number;
  matchingKeys: string[];
};

export type VendorProfileDocument = {
  organizationId: string;
  businessName: string;
  slug: string;
  description: string;
  primaryCategorySlug: string;
  additionalCategorySlugs: string[];
  services: string[];
  serviceAreaKeys: string[];
  serviceRadiusMiles: number | null;
  publicPhone: string | null;
  publicEmail: string | null;
  websiteUrl: string | null;
  googleBusinessProfileUrl: string | null;
  operatingHours: string | null;
  languages: string[];
  yearsInBusiness: number | null;
  customerTypes: string[];
  offersFreeEstimates: boolean;
  offersFinancing: boolean;
  emergencyService: boolean;
  license: { applies: boolean; number: string | null; jurisdiction: string | null; expiresAt: Timestamp | null };
  insurance: { status: "unknown" | "insured" | "not_insured" | "expired"; expiresAt: Timestamp | null };
  connectMemberBenefit: { enabled: boolean; title: string | null; description: string | null; type: string | null; terms: string | null; expiresAt: Timestamp | null };
  media: { logoPath: string | null; logoUrl: string | null; featuredImagePath: string | null; featuredImageUrl: string | null };
  approvalState: "pending" | "approved" | "changes_requested" | "rejected";
  publicationState: "unpublished" | "published" | "suspended";
  publicDisplayConsent: boolean;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export const SERVICE_REQUEST_STATUSES = ["submitted", "reviewing", "assigned", "accepted", "in_progress", "completed", "canceled"] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];
export type ServiceRequestPriority = "emergency" | "today" | "this_week" | "flexible";

export type ServiceRequestDocument = {
  propertyManagerOrganizationId: string;
  propertyId: string;
  propertyName: string;
  categorySlug: string;
  categoryName: string;
  serviceAreaKey: string;
  problemDescription: string;
  priority: ServiceRequestPriority;
  contactPreference: "phone" | "email";
  status: ServiceRequestStatus;
  activeAssignmentId: string | null;
  lastAssignmentId: string | null;
  acceptedVendorOrganizationId: string | null;
  acceptedVendorName: string | null;
  declinedVendorOrganizationIds: string[];
  submittedBy: string;
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
  canceledAt: Timestamp | null;
};

export type ServiceRequestPrivateDocument = {
  propertyManagerOrganizationId: string;
  acceptedVendorOrganizationId: string | null;
  exactAddress: string;
  unit: string | null;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  accessInstructions: string | null;
  attachmentPaths: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
