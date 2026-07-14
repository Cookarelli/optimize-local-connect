# Role and permission contract

The executable source of truth is `src/domain/auth/roles.ts`. This document describes intent; code and RLS changes must ship together.

`vendor` remains the technical role identifier for database and API compatibility. Optimize Local Connect™ presents that role as **Local Provider** in user-facing navigation and account context.

| Capability | Super Admin | Owner | Admin | Property Manager | Vendor | Technician | Future Resident |
|---|---:|---:|---:|---:|---:|---:|---:|
| Manage platform and markets | Yes | — | — | — | — | — | — |
| Manage organization and billing | Yes | Yes | Organization only | — | Vendor profile only | — | — |
| View members | Yes | Yes | Yes | Yes | Yes | — | — |
| Invite/manage members | Yes | Yes | Yes | — | Invite vendor team | — | — |
| Create/update properties | Yes | Yes | Yes | Yes | — | — | — |
| Delete properties | Yes | Yes | Yes | — | — | — | — |
| Create/manage service requests | Yes | Yes | Yes | Yes | — | — | Resident request only |
| Discover and invite vendors | Yes | Yes | Yes | Yes | — | — | — |
| Submit quotes | Yes | — | — | — | Yes | — | — |
| Award quotes | Yes | Yes | Yes | Yes | — | — | — |
| Manage vendor profile | Yes | — | — | — | Yes | — | — |
| View assigned work orders | Yes | Yes | Yes | Yes | Yes | Yes | — |
| Update work orders | Yes | — | — | — | Yes | Assigned only | — |
| View reports | Yes | Yes | Yes | Yes | — | — | — |
| Resident portal | Yes | — | — | — | — | — | Yes |

## Role intent

- **Super Admin:** global platform operator. Stored separately from organization membership and granted sparingly.
- **Owner:** highest authority inside one organization, including billing and ownership-sensitive operations.
- **Admin:** operational organization administrator without billing ownership.
- **Property Manager:** manages assigned organization properties, requests, vendors, and bid awards.
- **Vendor (Local Provider):** provider-company operator who manages the provider profile, team, quotes, and work.
- **Technician:** field worker limited to assigned work orders and necessary request context.
- **Future Resident:** reserved resident-facing identity with no access to internal property operations.

Permissions are organization-scoped unless explicitly global. A user may hold different roles in different organizations.
