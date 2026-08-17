import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";

const projectId = "demo-optimize-local-connect";
const firestoreRules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
const storageRules = await readFile(new URL("../storage.rules", import.meta.url), "utf8");
const environment = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: 8080, rules: firestoreRules }, storage: { host: "127.0.0.1", port: 9199, rules: storageRules } });
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function seedFirestore() {
  await environment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await Promise.all([
      setDoc(doc(firestore, "organizationMemberships", "vendor-org:vendor-owner"), { organizationId: "vendor-org", userId: "vendor-owner", role: "owner", status: "active" }),
      setDoc(doc(firestore, "organizationMemberships", "other-org:vendor-owner"), { organizationId: "other-org", userId: "vendor-owner", role: "owner", status: "active" }),
      setDoc(doc(firestore, "organizationMemberships", "pm-org:pm-owner"), { organizationId: "pm-org", userId: "pm-owner", role: "owner", status: "active" }),
      setDoc(doc(firestore, "organizationMemberships", "vendor-org:vendor-tech"), { organizationId: "vendor-org", userId: "vendor-tech", role: "technician", status: "active" }),
      setDoc(doc(firestore, "serviceRequestPrivate", "request-one"), { propertyManagerOrganizationId: "pm-org", acceptedVendorOrganizationId: null, attachmentPaths: ["service-requests/request-one/private/pm-owner/request_asset_0001"] }),
    ]);
  });
}

test.beforeEach(async () => { await environment.clearFirestore(); await environment.clearStorage(); await seedFirestore(); });
test.after(async () => { await environment.cleanup(); });

test("vendor draft rules enforce organization, MIME, and per-kind size", async () => {
  const ownerStorage = environment.authenticatedContext("vendor-owner").storage();
  await assertSucceeds(uploadBytes(ref(ownerStorage, "vendor-media/vendor-org/draft/vendor-owner/logo-one"), png, { contentType: "image/png", customMetadata: { assetKind: "logo" } }));
  await assertFails(uploadBytes(ref(ownerStorage, "vendor-media/unknown-org/draft/vendor-owner/logo-two"), png, { contentType: "image/png", customMetadata: { assetKind: "logo" } }));
  await assertFails(uploadBytes(ref(ownerStorage, "vendor-media/vendor-org/draft/vendor-owner/logo-svg"), new TextEncoder().encode("<svg/>") , { contentType: "image/svg+xml", customMetadata: { assetKind: "logo" } }));
  await assertFails(uploadBytes(ref(ownerStorage, "vendor-media/vendor-org/draft/vendor-owner/logo-large"), new Uint8Array(2 * 1024 * 1024 + 1), { contentType: "image/png", customMetadata: { assetKind: "logo" } }));
});

test("public media is anonymously readable but client writes are denied", async () => {
  await environment.withSecurityRulesDisabled(async (context) => { await uploadBytes(ref(context.storage(), "vendor-media/vendor-org/public/v1/logo"), png, { contentType: "image/png", customMetadata: { assetKind: "logo" } }); });
  const anonymous = environment.unauthenticatedContext().storage();
  assert.deepEqual(new Uint8Array(await assertSucceeds(getBytes(ref(anonymous, "vendor-media/vendor-org/public/v1/logo")))), png);
  await assertFails(uploadBytes(ref(anonymous, "vendor-media/vendor-org/public/v1/forged"), png, { contentType: "image/png" }));
});

test("request media is private until acceptance and upload paths must be pre-authorized", async () => {
  const pmStorage = environment.authenticatedContext("pm-owner").storage();
  const path = "service-requests/request-one/private/pm-owner/request_asset_0001";
  await assertSucceeds(uploadBytes(ref(pmStorage, path), png, { contentType: "image/png", customMetadata: { assetKind: "request" } }));
  await assertFails(uploadBytes(ref(pmStorage, "service-requests/request-one/private/pm-owner/unreserved"), png, { contentType: "image/png", customMetadata: { assetKind: "request" } }));
  const vendorStorage = environment.authenticatedContext("vendor-tech").storage();
  const unrelatedStorage = environment.authenticatedContext("unrelated").storage();
  await assertFails(getBytes(ref(vendorStorage, path)));
  await assertFails(getBytes(ref(unrelatedStorage, path)));
  await environment.withSecurityRulesDisabled(async (context) => { await updateDoc(doc(context.firestore(), "serviceRequestPrivate", "request-one"), { acceptedVendorOrganizationId: "vendor-org" }); });
  assert.equal((await assertSucceeds(getBytes(ref(vendorStorage, path)))).byteLength, png.byteLength);
});
