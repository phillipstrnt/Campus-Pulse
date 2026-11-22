# Campus Pulse

Campus Pulse is a campus community prototype with a short-video For You feed, posts, events, community announcements, messaging, and monthly membership tiers.

## Run the front end

```powershell
cd client
npm install
npm run dev
```

The current interface runs in demo mode and saves sample posts, events, RSVPs, and membership previews in the current browser. It is not yet a multi-user service: browser-local data does not sync between users or devices. Uploaded demo video previews do not survive a refresh.

## Free-tier backend starter

The project includes a Supabase schema at `supabase/migrations/20261122000100_campus_pulse.sql` for authentication profiles, reels, campus events, RSVPs, subscriptions, verification applications, row-level security, private media storage, and Realtime publication. With Supabase credentials configured, the app signs users in, uploads videos to private storage, queues reels/events for review, reads approved campus content, and listens for approved event announcements. Without credentials, it uses browser-local demo content.

1. Create a Supabase project and run the SQL migration in its SQL editor.
2. Copy `client/.env.example` to `client/.env.local` and enter the project URL and publishable anon key.
3. Configure Supabase Auth email confirmation and permitted university email domains.
4. Grant moderator access only to trusted staff by updating their `profiles.role` from `student` to `moderator` in the Supabase SQL editor. Never add a public role switch.
5. Run `npm run dev` from `client`, sign up, and test media/event review in a small private pilot.

Supabase's current free tier is suitable for a small pilot, with quotas and inactivity pauses. The free plan currently lists a 500 MB database, 1 GB file storage, and a 50 MB maximum upload size; check the current [Supabase pricing](https://supabase.com/pricing) before launch. Compress short clips, limit their length, and monitor storage and egress. A managed service is not cost-free at scale.

## Monthly memberships and payments

The interface has suggested monthly tiers for Pulse Plus, Creator, and Campus Promoter. The UGX amounts are placeholders for product testing and must be validated with students before charging. A paid state in the browser demo is not proof of payment.

Flutterwave is a practical Uganda-first provider to evaluate: its documentation lists UGX card and Uganda mobile-money checkout, plus monthly plans. Its payment-plan subscriptions are card-only, so MTN/Airtel Mobile Money should initially use monthly one-off checkout and renewal reminders unless the provider confirms recurring mobile-money support. Keep secret keys on a trusted server or Edge Function, verify signed payment webhooks, and only then update `subscriptions`. Never trust client-side plan selection to grant paid access. See [Flutterwave Uganda payment methods](https://developer.flutterwave.com/docs/payment-methods) and [payment plans](https://developer.flutterwave.com/docs/recurring-payments/payment-plans).

Paystack is not a good initial merchant choice for a Uganda-registered business: its current support documentation lists Nigeria, Ghana, South Africa, and Kenya as supported merchant countries, not Uganda.

## Before launch

- Add a moderator reel-review screen, moderator audit logs, and operational removal/appeal tools. Reel uploads stay private and pending until approved.
- Set production limits for video duration, video transcoding, storage cleanup, comment moderation, rate limits, and access control.
- Add server-verified payment checkout/webhooks, cancellations, renewals, receipts, and delinquent-subscription handling.
- Add real push notifications and Realtime listeners for approved campus announcements.
- Add video transcoding, content reporting, blocking, rate limits, retention rules, privacy terms, and campus safety review.
- Connect a WebRTC/video provider before marketing live calls or livestreams as available.

Run a production build and lint from `client` with `npm run build` and `npm run lint`.
