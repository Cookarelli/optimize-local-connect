# Firebase staging demo

The Firebase operational backend remains off by default. Enable it only in a non-production environment by setting both `OPERATIONAL_BACKEND=firebase` and `NEXT_PUBLIC_OPERATIONAL_BACKEND=firebase`. Do not enable either production flag or remove the legacy Supabase path.

## Required configuration

Browser configuration: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, and `NEXT_PUBLIC_FIREBASE_APP_ID`.

Server configuration: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `FIREBASE_STORAGE_BUCKET`.

The project needs Email/Password authentication enabled. Set `NEXT_PUBLIC_FIREBASE_GOOGLE_SIGN_IN_ENABLED=true` only after Google authentication is enabled in that Firebase project. Use the auth configuration script to add the exact preview or staging host as an authorized domain; it refuses the production project.

## Transactional email delivery

The Firestore outbox delivers assignment, reassignment, acceptance, decline, work-started, and completed updates through a provider adapter. To enable it, configure a verified Resend sender and set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, and `NOTIFICATION_WORKER_SECRET`. Do not put any of these values in browser variables.

Use a scheduler to call `POST /api/internal/firebase/notifications` with `Authorization: Bearer <NOTIFICATION_WORKER_SECRET>`, or run `npm run deliver:firebase:notifications` in a trusted scheduled process. Both paths retain deterministic notification IDs, provider idempotency keys, atomic claims, and exponential retry scheduling. With no provider configuration, notifications stay queued and no delivery call is attempted.

## Seed and rehearse

All fixture records are labelled `stagingFixture: true`, use `*.staging.optimizelocal.example` addresses, and are safe to rerun. The seed uses only fictional demo organizations; it does not mutate Founder payment evidence.

```bash
FIREBASE_PROJECT_ID=your-staging-project \
FIREBASE_STAGING_TEST_PASSWORD='set-outside-source-control' \
npm run seed:firebase:staging -- --apply --confirm-project=your-staging-project --firebase-cli-account=your-account@example.com

FIREBASE_PROJECT_ID=your-staging-project \
npm run rehearse:firebase:staging -- --apply --confirm-project=your-staging-project --firebase-cli-account=your-account@example.com
```

The seed creates a PM user, platform administrator, several Rockford properties, and approved/published electrical and plumbing demo vendors with overlapping service areas. Sign in using the seeded email addresses and the password supplied at seed time; do not add passwords to source control.

## Local verification

```bash
npm run test:firestore
npm run test:storage
npm run test:migration
npm run typecheck
npm run lint
npm run build
git diff --check
```

The emulator workflow verifies private data before vendor acceptance, deterministic eligible-vendor selection, assignment/reassignment, accept/decline retries, vendor progress/completion, PM accepted-vendor visibility, and notification retry handling.
