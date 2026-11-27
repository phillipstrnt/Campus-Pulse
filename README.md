# Campus Pulse

## Live preview

[Open Campus Pulse](https://phillipstrnt.github.io/Campus-Pulse/)

Campus Pulse is a campus community prototype for short video, campus interests, nearby discovery, events, verified student accounts, live-room schedules, marketplace listings, hostel listings, and monthly member plans.

## Run the preview

```powershell
cd client
npm install
npm run dev
```

Without Supabase credentials, the site runs in preview mode: preview accounts, posts, photos/videos, stories, events, RSVPs, listings and profile edits are stored in this browser only (IndexedDB is used for media). Preview signup checks email format, but cannot confirm mailbox ownership or sync data to other devices. Configure Supabase and apply every migration for real email confirmation and shared, cloud-saved accounts and content.

## Supabase Free setup

Supabase is the selected pilot database, auth, storage, and realtime provider. It keeps the app on managed PostgreSQL and supports row-level access policies; it is appropriate for a small pilot, with usage limits and inactivity pauses. Review [Supabase pricing](https://supabase.com/pricing) before launch.

1. Create a Supabase project and apply migrations in filename order from `supabase/migrations/`.
2. For GitHub Pages, add repository Actions secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then rerun the Pages workflow. Use only the public anon/publishable key; never expose a service-role key in a browser build. Locally, copy `client/.env.example` to `client/.env.local` and enter the same project URL and public key.
3. The second migration enables PostGIS for nearby discovery and adds private, rounded location storage. If your project does not allow enabling extensions by SQL, enable PostGIS in the Supabase Extensions page first.
4. The migration seeds verified Makerere domains for campus labels. Any syntactically valid email can register; campus email domains are optional. Configure Supabase Auth to require email confirmation so live accounts must prove mailbox ownership. The date of birth is checked by a database trigger and discarded instead of being retained.
5. These are build-time client settings: after changing them, rebuild locally or rerun the Pages workflow. A successful UI deploy without both values stays in browser-preview mode.
6. Apply `20261122000300_messaging_and_reports.sql` for persistent private conversations, message row-level security, blocking, and moderator-only safety reports. Then apply `20261122000500_open_beta_social.sql`: during the open beta it removes the subscription gate and requires mutual follows before users can chat.
7. Apply `20261122000600_campus_stories.sql` to enable cloud stories that expire after 24 hours.
8. Apply `20261127000100_secure_conversation_realtime.sql` after the other migrations. It authorizes private Realtime typing channels only for both members of an unblocked conversation.
9. Add trusted moderators in `public.profiles` only through the Supabase SQL editor. Moderators can review events, listings, hostel posts, and room schedules.

Makerere's official student-email guidance describes its current `@students.mak.ac.ug` format and legacy college-domain addresses. See [Makerere student email setup](https://news.mak.ac.ug/wp-content/uploads/2025/09/Freshers-joining-Instructions-2025-2026.pdf) and [Makerere email support](https://answers.mak.ac.ug/email/getting-email). The allowlist is intentionally administrator-controlled; maintain the supported domains as institutions migrate.

## Product and safety policy

- Discovery categories include Sports, Science & tech, Drama & arts, Entertainment, campus life, and adult dating. Dating is restricted to 18+ users. Nudity and explicit sexual content are prohibited.
- Nearby search requests browser location only after the member selects Nearby. Coordinates are rounded to roughly 1 km, stored in a private schema, and only approximate distance is returned. Members can switch it off to delete the saved location.
- Reels, events, marketplace items, hostel rooms, and live-room schedules are submitted for moderator review. Listing photos use private storage and signed URLs.
- Existing account emails are unique. The migration also fingerprints normalized emails and common Gmail aliases. Other proxy identities or account farms cannot be reliably linked from email alone; for a broader launch, add verified student-number checks, Supabase Auth CAPTCHA/rate limits, and a manual appeal path instead of invasive device fingerprinting.
- Meetup guidance recommends public locations, no advance deposits before viewing, and private contact details. Report/block flows and account appeals should be completed before opening registration broadly.

## Scale and launch boundaries

The migrations add feed and seller indexes, page-sized queries, private media, row-level security, and PostGIS for location queries. This gives the pilot a clean path to scale while keeping sensitive location rows out of the public API. Supabase recommends RLS on every exposed table; see [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security). For high-volume event notifications, use Realtime Broadcast with private channel authorization; Supabase notes it scales better than Postgres Changes for broadcasts ([Realtime subscriptions](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)).

The app currently stores live-room schedules, but actual livestreams/video calls still need a WebRTC media provider and a secure server endpoint that issues short-lived room tokens. LiveKit is a reasonable provider to evaluate; its free Build plan has hard usage caps, so confirm the current quotas and costs before a public launch ([LiveKit quotas](https://docs.livekit.io/deploy/admin/quotas-and-limits/)). Video transcoding, signed upload quotas, abuse monitoring, retention, and media moderation should be configured before creator growth.

Paid plan selection in the demo is not proof of payment. Production subscriptions require checkout plus verified server-side payment webhooks before granting membership access. Prices in the demo are research placeholders.

## Validate the client

From the repository root:

```powershell
npm run build --prefix client
npm run lint --prefix client
npm test --prefix client
```

The preview account tests cover normalized registration, password hashing, sign-in after reload, and duplicate/invalid account rejection. Preview accounts remain local to the browser; they are not shared demo logins. Use a fresh email and username to try registration, then sign out and sign in with the same details.
