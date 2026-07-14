# Authentication and organization access

Optimize Local Connect™ uses Supabase Auth for shared platform identity, PostgreSQL memberships for authorization, and `@supabase/ssr` cookies for persistent browser sessions. UI checks improve usability; database row-level security remains the final authorization boundary across every industry vertical.

## Supported sign-in methods

| Method | Status | Configuration |
| --- | --- | --- |
| Email and password | Active | Enable the email provider in Supabase Auth. Accounts are created through invitations. |
| Magic link | Active | Configure Supabase email templates and SMTP. Account creation is disabled for this flow. |
| Google OAuth | Active | Add Google credentials in Supabase Auth and register the Supabase OAuth callback URL with Google. |
| Microsoft | Provider-ready | Enable after Azure credentials and tenant policy are approved. |
| Apple | Provider-ready | Enable after Apple Services ID, key, and redirect configuration are approved. |

## Required configuration

- `NEXT_PUBLIC_APP_URL`: canonical application origin.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: browser-safe anonymous key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used solely to deliver administrative invitations. Never expose it through a `NEXT_PUBLIC_` variable.

Add both callback URLs to the Supabase Auth redirect allowlist:

- `http://localhost:3000/auth/callback`
- `https://optimize-local-property-os.cookarelli.chatgpt.site/auth/callback`

Use a production SMTP provider and customize the invite, magic-link, and password-recovery templates before launch. OAuth client secrets belong in Supabase provider configuration, not application environment variables.

## Session and role routing

`proxy.ts` refreshes Supabase cookies, redirects anonymous requests away from protected routes, and adds baseline browser security headers. Protected layouts and server actions validate the user again. Role pages enforce organization type and role requirements; PostgreSQL RLS validates every operation.

| User context | Destination |
| --- | --- |
| Super Admin | `/admin` |
| Property organization Owner or Admin | `/admin` |
| Property Manager | `/manager` |
| Local Provider organization Owner, Admin, Vendor, or Technician | `/vendor` |
| Future Resident | `/resident` |
| User without a membership | `/onboarding` |

The active organization preference is accepted only when the user has a matching active membership. This supports multi-organization users without trusting client-provided organization identifiers.

## Invitation lifecycle

1. An authorized Owner or Admin chooses an allowed role and email.
2. The database creates a seven-day invitation and stores only a SHA-256 token hash.
3. Supabase sends an invite to a new account or a magic link to an existing account.
4. The callback establishes a session and opens the acceptance screen.
5. The database locks the invitation, verifies the JWT email, activates membership, records acceptance, and selects the organization.

Invitations are single-use, email-bound, expiring, and revocable. Owners may assign privileged roles; Admins may invite only operational roles.

## Recovery behavior

Password-reset requests always return the same response to prevent account enumeration. Recovery links use the allowlisted callback. New passwords require at least 12 characters with uppercase, lowercase, and numeric characters.

## Deployment order

1. Apply every SQL migration with `supabase db push`.
2. Configure SMTP, provider credentials, site URL, and redirect URLs in Supabase.
3. Set the four application environment values.
4. Test password, magic link, Google, recovery, new-user invite, existing-user invite, role routing, organization switching, and sign-out against staging.
