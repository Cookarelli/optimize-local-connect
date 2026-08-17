import "server-only";

import { basename } from "node:path";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import type { AppUser } from "@/src/domain/auth/types";
import type { ServiceRequestPrivateDocument, VendorProfileDocument } from "@/src/domain/firebase-platform/types";
import { getFirebaseStorageBucket, getPlatformFirestore } from "@/src/lib/firebase/admin";
import { requireOrganizationMembership } from "@/src/lib/firebase/authorization";

export type FirebaseImageKind = "logo" | "featured" | "request";

export const FIREBASE_IMAGE_LIMITS: Record<FirebaseImageKind, number> = {
  logo: 2 * 1024 * 1024,
  featured: 8 * 1024 * 1024,
  request: 10 * 1024 * 1024,
};

const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateFirebaseImage(bytes: Uint8Array, contentType: string, kind: FirebaseImageKind) {
  if (!MIME_TYPES.has(contentType)) throw new Error("Only JPG, PNG, and WebP images are supported.");
  if (!bytes.length || bytes.length > FIREBASE_IMAGE_LIMITS[kind]) throw new Error("Image exceeds the allowed size.");
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if ((contentType === "image/jpeg" && !jpeg) || (contentType === "image/png" && !png) || (contentType === "image/webp" && !webp)) {
    throw new Error("Image bytes do not match the declared content type.");
  }
}

function firebaseMediaUrl(bucket: string, path: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`;
}

export async function registerFirebaseVendorDraftMedia(input: { user: AppUser; organizationId: string; assetKind: "logo" | "featured"; draftPath: string }, db: Firestore = getPlatformFirestore()) {
  requireOrganizationMembership(input.user, input.organizationId, ["owner", "admin"]);
  const expectedPrefix = `vendor-media/${input.organizationId}/draft/${input.user.id}/`;
  if (!input.draftPath.startsWith(expectedPrefix) || basename(input.draftPath) !== input.draftPath.slice(expectedPrefix.length)) throw new Error("Invalid vendor media path.");
  const bucket = getFirebaseStorageBucket();
  const file = bucket.file(input.draftPath);
  const [exists] = await file.exists();
  if (!exists) throw new Error("Uploaded image was not found.");
  const [metadata, bytes] = await Promise.all([file.getMetadata().then(([value]) => value), file.download().then(([value]) => value)]);
  const contentType = metadata.contentType ?? "";
  if (metadata.metadata?.assetKind !== input.assetKind) throw new Error("Image metadata does not match the requested asset.");
  validateFirebaseImage(bytes, contentType, input.assetKind);
  const profileRef = db.doc(`vendorProfiles/${input.organizationId}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    const profile = snapshot.data() as VendorProfileDocument | undefined;
    if (!profile) throw new Error("Complete the vendor profile before uploading media.");
    const media = { ...profile.media };
    if (input.assetKind === "logo") { media.logoPath = input.draftPath; media.logoUrl = null; }
    else { media.featuredImagePath = input.draftPath; media.featuredImageUrl = null; }
    transaction.update(profileRef, { media, approvalState: "pending", publicationState: "unpublished", updatedAt: Timestamp.now() });
    transaction.delete(db.doc(`publicMarketplaceVendors/${input.organizationId}`));
  });
}

export async function promoteFirebaseVendorMedia(organizationId: string, db: Firestore = getPlatformFirestore()) {
  const profileRef = db.doc(`vendorProfiles/${organizationId}`);
  const snapshot = await profileRef.get();
  const profile = snapshot.data() as VendorProfileDocument | undefined;
  if (!profile) throw new Error("Vendor profile not found.");
  const bucket = getFirebaseStorageBucket();
  const version = String(Date.now());
  const nextMedia = { ...profile.media };
  for (const kind of ["logo", "featured"] as const) {
    const sourcePath = kind === "logo" ? profile.media.logoPath : profile.media.featuredImagePath;
    if (!sourcePath || sourcePath.includes("/public/")) continue;
    if (!sourcePath.startsWith(`vendor-media/${organizationId}/draft/`)) throw new Error("Vendor media path is outside the organization draft area.");
    const source = bucket.file(sourcePath);
    const [metadata, bytes] = await Promise.all([source.getMetadata().then(([value]) => value), source.download().then(([value]) => value)]);
    if (metadata.metadata?.assetKind !== kind) throw new Error("Vendor media metadata is invalid.");
    validateFirebaseImage(bytes, metadata.contentType ?? "", kind);
    const publicPath = `vendor-media/${organizationId}/public/${version}/${basename(sourcePath)}`;
    const destination = bucket.file(publicPath);
    await source.copy(destination);
    await destination.setMetadata({ contentType: metadata.contentType, cacheControl: "public,max-age=31536000,immutable", metadata: { assetKind: kind, sourcePath } });
    if (kind === "logo") { nextMedia.logoPath = publicPath; nextMedia.logoUrl = firebaseMediaUrl(bucket.name, publicPath); }
    else { nextMedia.featuredImagePath = publicPath; nextMedia.featuredImageUrl = firebaseMediaUrl(bucket.name, publicPath); }
  }
  if (JSON.stringify(nextMedia) !== JSON.stringify(profile.media)) await profileRef.update({ media: nextMedia, updatedAt: Timestamp.now() });
  return nextMedia;
}

export async function reserveFirebaseRequestMediaUpload(input: { user: AppUser; requestId: string; assetId: string }, db: Firestore = getPlatformFirestore()) {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(input.assetId)) throw new Error("Invalid request media identifier.");
  const privateRef = db.doc(`serviceRequestPrivate/${input.requestId}`);
  const path = `service-requests/${input.requestId}/private/${input.user.id}/${input.assetId}`;
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(privateRef);
    const data = snapshot.data() as ServiceRequestPrivateDocument | undefined;
    if (!data) throw new Error("Request not found.");
    requireOrganizationMembership(input.user, data.propertyManagerOrganizationId, ["owner", "admin", "manager", "staff", "property_manager"]);
    if (data.attachmentPaths.includes(path)) return;
    if (data.attachmentPaths.length >= 5) throw new Error("A request may contain at most five images.");
    transaction.update(privateRef, { attachmentPaths: [...data.attachmentPaths, path], updatedAt: Timestamp.now() });
  });
  return path;
}

export async function finalizeFirebaseRequestMediaUpload(input: { user: AppUser; requestId: string; path: string }, db: Firestore = getPlatformFirestore()) {
  const privateRef = db.doc(`serviceRequestPrivate/${input.requestId}`);
  const snapshot = await privateRef.get();
  const data = snapshot.data() as ServiceRequestPrivateDocument | undefined;
  if (!data) throw new Error("Request not found.");
  requireOrganizationMembership(input.user, data.propertyManagerOrganizationId, ["owner", "admin", "manager", "staff", "property_manager"]);
  const expectedPrefix = `service-requests/${input.requestId}/private/${input.user.id}/`;
  if (!input.path.startsWith(expectedPrefix) || !data.attachmentPaths.includes(input.path)) throw new Error("Request media path was not authorized.");
  const file = getFirebaseStorageBucket().file(input.path);
  try {
    const [metadata, bytes] = await Promise.all([file.getMetadata().then(([value]) => value), file.download().then(([value]) => value)]);
    if (metadata.metadata?.assetKind !== "request") throw new Error("Request image metadata is invalid.");
    validateFirebaseImage(bytes, metadata.contentType ?? "", "request");
  } catch (error) {
    await Promise.allSettled([file.delete({ ignoreNotFound: true }), privateRef.update({ attachmentPaths: FieldValue.arrayRemove(input.path), updatedAt: Timestamp.now() })]);
    throw error;
  }
  return { path: input.path };
}
