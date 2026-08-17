import { getFounderFirestore } from "../src/lib/firebase/admin";
import { releaseManuallyGrantedFounder } from "../src/lib/founder-categories/firestore";

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const categorySlug = argument("category");
const organizationId = argument("organization");
const membershipId = argument("membership");
const eventId = argument("event-id");
const releasedBy = argument("released-by");
const reason = argument("reason");
const apply = process.argv.includes("--apply");

if (!projectId) throw new Error("Missing Firebase Admin environment: FIREBASE_PROJECT_ID");
if (!categorySlug || !organizationId || !membershipId || !eventId || !releasedBy || !reason) {
  throw new Error("Release requires category, organization, membership, event-id, released-by, and reason arguments.");
}
if (apply) {
  const confirmations = [
    `--confirm-project=${projectId}`,
    `--confirm-category=${categorySlug}`,
    `--confirm-organization=${organizationId}`,
    `--confirm-membership=${membershipId}`,
    "--confirm-release=MANUAL_FOUNDER_RELEASE",
  ];
  const missing = confirmations.filter((confirmation) => !process.argv.includes(confirmation));
  if (missing.length) throw new Error(`Release aborted. Missing exact confirmation: ${missing.join(", ")}`);
}

const db = getFounderFirestore();

async function readState() {
  const [category, publicCategory, membership, occupancy, organization, payments] = await Promise.all([
    db.doc(`founderCategories/${categorySlug}`).get(), db.doc(`publicFounderCategories/${categorySlug}`).get(),
    db.doc(`memberships/${membershipId}`).get(), db.doc(`founderOccupancies/${organizationId}`).get(),
    db.doc(`organizations/${organizationId}`).get(), db.collection("founderPayments").where("membershipId", "==", membershipId).get(),
  ]);
  const categoryData = category.data();
  const publicData = publicCategory.data();
  const membershipData = membership.data();
  const occupancyData = occupancy.data();
  const organizationData = organization.data();
  return {
    recordIds: { category: category.ref.path, publicCategory: publicCategory.ref.path, membership: membership.ref.path, occupancy: occupancy.ref.path, organization: organization.ref.path },
    category: { exists: category.exists, status: categoryData?.status ?? null, publicBusinessName: categoryData?.publicBusinessName ?? null, claimedOrganizationId: categoryData?.claimedOrganizationId ?? null, membershipId: categoryData?.membershipId ?? null, paymentSource: categoryData?.paymentSource ?? null },
    publicCategory: { exists: publicCategory.exists, status: publicData?.status ?? null, publicBusinessName: publicData?.publicBusinessName ?? null },
    membership: { exists: membership.exists, status: membershipData?.status ?? null, organizationId: membershipData?.organizationId ?? null, categorySlug: membershipData?.categorySlug ?? null, paymentSource: membershipData?.paymentSource ?? null, actualAmountPaidCents: membershipData?.actualAmountPaidCents ?? null, stripeIsNull: membershipData?.stripe === null, paypalIsNull: membershipData?.paypal === null },
    occupancy: { exists: occupancy.exists, status: occupancyData?.status ?? null, categorySlug: occupancyData?.categorySlug ?? null, membershipId: occupancyData?.membershipId ?? null },
    organization: { exists: organization.exists, name: organizationData?.name ?? null, activeMembershipId: organizationData?.activeMembershipId ?? null, pendingMembershipId: organizationData?.pendingMembershipId ?? null },
    founderPaymentRecordIds: payments.docs.map((document) => document.id),
  };
}

const before = await readState();
if (!apply) {
  process.stdout.write(`${JSON.stringify({ mode: "dry-run", projectId, before }, null, 2)}\n`);
  process.exit(0);
}

const result = await releaseManuallyGrantedFounder({ categorySlug, organizationId, membershipId, eventId, releasedBy, reason }, db);
const after = await readState();
if (after.category.status !== "available" || after.category.publicBusinessName !== null || after.publicCategory.status !== "available" || after.publicCategory.publicBusinessName !== null || after.membership.status !== "expired" || after.occupancy.status !== "released") {
  throw new Error("Founder release verification failed.");
}
process.stdout.write(`${JSON.stringify({ mode: "apply", projectId, result, before, after }, null, 2)}\n`);
