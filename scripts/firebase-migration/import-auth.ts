import { z } from "zod";
import type { UserImportRecord } from "firebase-admin/auth";
import { getMigrationAuth } from "./admin";
import { migrationChecksum, migrationMode, readJsonFile, report } from "./shared";

const exportSchema = z.object({
  users: z.array(z.object({
    id: z.string(), email: z.string().email().nullable(), encrypted_password: z.string().nullable().optional(),
    email_confirmed_at: z.string().nullable().optional(), raw_user_meta_data: z.record(z.string(), z.unknown()).nullable().optional(),
  })),
  identities: z.array(z.object({ user_id: z.string(), provider: z.string(), provider_id: z.string().nullable().optional(), identity_data: z.record(z.string(), z.unknown()).nullable().optional() })).default([]),
});

const mode = migrationMode();
const raw = await readJsonFile(mode.path);
const parsed = exportSchema.parse(raw);
const auth = getMigrationAuth();
const emailOwners = new Map<string, string>();
const providerOwners = new Map<string, string>();
const identitiesByUser = new Map<string, typeof parsed.identities>();
const conflicts: string[] = [];
const warnings: string[] = [];
const activationFallback: string[] = [];
const records: UserImportRecord[] = [];

for (const identity of parsed.identities) identitiesByUser.set(identity.user_id, [...(identitiesByUser.get(identity.user_id) ?? []), identity]);
for (const user of parsed.users) {
  if (!user.id || Buffer.byteLength(user.id, "utf8") > 128) { conflicts.push(`invalid_uid:${user.id || "<empty>"}`); continue; }
  if (!user.email) { activationFallback.push(user.id); warnings.push(`missing_email:${user.id}`); continue; }
  const email = user.email.toLowerCase();
  const priorEmailOwner = emailOwners.get(email);
  if (priorEmailOwner && priorEmailOwner !== user.id) { conflicts.push(`duplicate_source_email:${email}`); continue; }
  emailOwners.set(email, user.id);
  const providerData = (identitiesByUser.get(user.id) ?? []).filter((identity) => identity.provider === "google" || identity.provider === "google.com").flatMap((identity) => {
    const providerId = identity.provider_id ?? String(identity.identity_data?.sub ?? "");
    if (!providerId) { warnings.push(`google_identity_missing_provider_id:${user.id}`); return []; }
    const key = `google.com:${providerId}`;
    const priorProviderOwner = providerOwners.get(key);
    if (priorProviderOwner && priorProviderOwner !== user.id) { conflicts.push(`duplicate_source_provider:${key}`); return []; }
    providerOwners.set(key, user.id);
    return [{ uid: providerId, providerId: "google.com", email, displayName: typeof identity.identity_data?.full_name === "string" ? identity.identity_data.full_name : undefined, photoURL: typeof identity.identity_data?.avatar_url === "string" ? identity.identity_data.avatar_url : undefined }];
  });
  const record: UserImportRecord = { uid: user.id, email, emailVerified: Boolean(user.email_confirmed_at), displayName: typeof user.raw_user_meta_data?.full_name === "string" ? user.raw_user_meta_data.full_name : undefined, providerData };
  if (user.encrypted_password) record.passwordHash = Buffer.from(user.encrypted_password);
  else if (!providerData.length) activationFallback.push(user.id);
  records.push(record);
}

const existingUids = new Set<string>();
for (let index = 0; index < records.length; index += 25) {
  const batch = records.slice(index, index + 25);
  const identifiers = batch.flatMap((record) => [
    { uid: record.uid },
    ...(record.email ? [{ email: record.email }] : []),
    ...(record.providerData ?? []).map((provider) => ({ providerId: provider.providerId, providerUid: provider.uid })),
  ]);
  const target = await auth.getUsers(identifiers);
  for (const record of batch) {
    const uidMatch = target.users.find((user) => user.uid === record.uid);
    const emailMatch = record.email ? target.users.find((user) => user.email?.toLowerCase() === record.email!.toLowerCase()) : undefined;
    const providerMatch = (record.providerData ?? []).flatMap((provider) => target.users.filter((user) => user.providerData.some((item) => item.providerId === provider.providerId && item.uid === provider.uid)))[0];
    if (uidMatch) {
      if (uidMatch.email?.toLowerCase() !== record.email?.toLowerCase()) conflicts.push(`target_uid_email_conflict:${record.uid}`);
      else existingUids.add(record.uid);
      const missingProvider = (record.providerData ?? []).some((provider) => !uidMatch.providerData.some((item) => item.providerId === provider.providerId && item.uid === provider.uid));
      if (missingProvider) warnings.push(`existing_user_requires_provider_link:${record.uid}`);
    }
    if (emailMatch && emailMatch.uid !== record.uid) conflicts.push(`target_email_conflict:${record.email}`);
    if (providerMatch && providerMatch.uid !== record.uid) conflicts.push(`target_provider_conflict:${record.uid}`);
  }
}

const importable = records.filter((record) => !existingUids.has(record.uid));
if (mode.apply && conflicts.length) throw new Error(`Auth import conflicts must be resolved before apply: ${conflicts.length}. Run a dry-run for the conflict manifest.`);
if (mode.apply) {
  for (let index = 0; index < importable.length; index += 1000) {
    const result = await auth.importUsers(importable.slice(index, index + 1000), { hash: { algorithm: "BCRYPT" } });
    if (result.failureCount) throw new Error(`Firebase rejected ${result.failureCount} users in batch ${index / 1000 + 1}.`);
  }
}
report({
  manifestVersion: 1, mode: mode.apply ? "apply" : "dry-run", sourceChecksum: migrationChecksum(raw), users: parsed.users.length, identities: parsed.identities.length,
  plannedImportChecksum: migrationChecksum(importable.map((record) => ({ uid: record.uid, email: record.email, emailVerified: record.emailVerified, providers: record.providerData?.map((provider) => provider.providerId) }))),
  importable: importable.length, existingUsersSkipped: existingUids.size, passwordUsers: importable.filter((item) => item.passwordHash).length,
  googleUsers: importable.filter((item) => item.providerData?.some((provider) => provider.providerId === "google.com")).length,
  activationFallback: activationFallback.length, conflicts, warnings,
});
