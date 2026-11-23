# TopGram

Independent messaging app starter built with Vite and Supabase.

## Setup
1. Copy `.env.example` to `.env`.
2. Add the URL and publishable/anon key for the Supabase project dedicated to TopGram.
3. Run `npm install` then `npm run dev`.
4. Enable Email OTP in Supabase Auth.
5. Apply the TopGram base schema and `supabase/sql/topgram-admin.sql` to the dedicated TopGram database.
6. Deploy `supabase/functions/topgram-admin/index.ts` as the `topgram-admin` Edge Function with JWT verification enabled.

Never put a service-role or secret key in browser code or commit it to Git.

## Admin bootstrap
After creating and verifying your own TopGram account, assign `{"topgram_role":"owner"}` to that account in Supabase Auth user **app_metadata** (not editable user_metadata). Sign out and back in so the JWT refreshes. Only the owner can grant/revoke admin roles and assign collectible usernames. The `+888 8888` value is a display alias, not proof of ownership.

## Included
- TopGram-only email OTP
- Profiles, direct chats and realtime messages
- Admin user lookup and moderation audit logs
- Server-side star adjustments, freeze/unfreeze, soft-delete
- Owner-only admin role management and collectible username assignment
- Limited collectible gift drafts, publication and numbered issuance

The Edge Function authenticates the caller, checks server-issued app_metadata, and invokes a database function executable only by service_role. No Telegram login-code relay, Telegram account access, or NFT marketplace is included. Account deletion is currently a soft-delete; permanent auth-user deletion needs a separate confirmed retention/deletion workflow.
