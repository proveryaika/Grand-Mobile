# TopGram

Independent messaging app starter built with Vite and Supabase.

## Setup
1. Copy `.env.example` to `.env`.
2. Add the Supabase project URL and publishable/anon key.
3. Run `npm install` then `npm run dev`.
4. Enable Email OTP in Supabase Auth.

Never expose service-role or secret keys in the browser.

## Included
- TopGram-only email OTP sign-in
- Unique user profiles
- Direct conversations and realtime message subscription
- Internal star balance display
- Separate `tg_*` database tables with RLS

## Security / remaining work
Administrative operations require audited server-side Edge Functions and are not enabled yet. Owner privileges must be assigned to a verified auth identity via server-issued app metadata. `+888 8888` is display-only. No Telegram code relay or NFT marketplace is included.
