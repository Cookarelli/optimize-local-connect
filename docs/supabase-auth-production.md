# Supabase Auth production URLs

Configure these values manually in Supabase Dashboard → Authentication → URL Configuration. Do not use a Vercel preview URL for the production Site URL.

- Site URL: `https://optimizelocalai.com`
- Redirect URLs:
  - `https://optimizelocalai.com/auth/callback`
  - `https://optimizelocalai.com/membership/claim`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/membership/claim`

Membership claim links are internal paths passed through `/auth/callback`; Supabase must allow the callback URL, while the application safely returns the user to `/membership/claim` after authentication.
