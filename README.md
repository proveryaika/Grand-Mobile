# TopGram

Independent messaging app starter using Vite and Supabase.

## Setup
1. Copy `.env.example` to `.env`.
2. Add Supabase project URL and publishable/anon key.
3. Run `npm install` and `npm run dev`.
4. Enable Email OTP in Supabase Auth.

Never put service-role or secret keys in the browser.

## Current scope
TopGram-only email OTP, user profiles, direct conversations and realtime messaging are the initial app scope. Database objects are isolated under `tg_*` and existing project tables remain untouched.

Admin operations must be implemented as authenticated, audited server-side functions. Owner permissions must be assigned to a verified auth identity through server-side app metadata. The `+888 8888` alias is display-only. No Telegram login-code relay or NFT marketplace is included.
