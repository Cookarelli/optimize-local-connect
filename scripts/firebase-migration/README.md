# Firebase migration utilities

These scripts prepare the later one-time cutover. They are not runtime bridges and must not be scheduled as dual-write jobs.

## Safety defaults

- Omitting `--apply` is a dry run. Dry runs emit a JSON manifest with source and planned-write checksums, counts, warnings, and conflicts.
- Applying to `optimize-local` is locked unless `ALLOW_PRODUCTION_FIREBASE_IMPORT=I_UNDERSTAND` is set explicitly.
- Rehearse with the Firebase emulators or a staging Firebase project before any production import.
- Existing mapped Founder organization, membership, and profile documents win conflicts and are reported without being overwritten.
- Password hashes, access tokens, OAuth secrets, and full imported records are never printed.

## Authentication export

```sh
npm run migrate:firebase:auth -- /absolute/path/auth-export.json
npm run migrate:firebase:auth -- /absolute/path/auth-export.json --apply
```

The JSON object contains `users` and optional `identities` arrays shaped like a Supabase Auth export. The importer preserves valid UIDs, imports bcrypt hashes with Firebase Admin, maps Google provider identities, carries `emailVerified`, detects source and Firebase-target conflicts, skips exact existing users, and counts accounts that require an activation/password-reset fallback.

## Operational data export

```sh
npm run migrate:firebase:data -- /absolute/path/data-export.json
npm run migrate:firebase:data -- /absolute/path/data-export.json --apply
```

Supported arrays are `users`, `organizations`, `organization_members`, `vendor_profiles`, `properties`, `vendor_memberships`, `property_manager_service_requests`, and `property_manager_service_request_history`. The legacy `service_requests` array is counted but intentionally ignored so only one request model is imported.

Use `founderMappings` and `founderMembershipMappings` objects to map legacy Supabase IDs to the existing authoritative Firestore Founder IDs. Request assignments and history IDs are deterministic, and all writes use merge semantics for safe retries.

## Existing Founder operational structure

```sh
npm run migrate:firebase:founders
npm run migrate:firebase:founders -- --apply
```

Dry run reports whether each claimed Founder needs a minimal unpublished `vendorProfiles` document. Apply enriches the existing organization and membership documents in place; it does not recreate IDs or invent profile/payment facts.

## Service catalog

```sh
npm run migrate:firebase:catalog
npm run migrate:firebase:catalog -- --apply
```

This prepares the 25 canonical service category documents without changing Founder category occupancy.
