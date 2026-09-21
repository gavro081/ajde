# Profile and ride contact details

Profiles now require a phone number to complete onboarding. Existing users without a valid number
are redirected to the same prefilled form and can keep their photo. The owner-only **Edit profile
& contacts** link on their profile returns to this form. Phone formatting is normalized to 7–15
digits with an optional leading +; this is format validation, not SMS ownership verification.

An optional HTTPS social-profile URL supports Facebook, Instagram, X, and other services. The
additive `20260921180000_profile_social_url.sql` migration is applied to the configured Supabase
project; types were regenerated from its profile column catalog. Existing Facebook/Instagram
fields remain available. Legacy phone values remain nullable in storage; application profile
completion and booking/chat actions enforce the requirement.

Drivers see callable phone numbers for requested and accepted bookings on their own rides.
Accepted room members see each current participant's phone and social links in the sidebar or
mobile participant strip. Historical message authors remain name/photo only. Public profile
queries do not include contacts. Social links open in a new tab with `noopener noreferrer` and
unsafe URLs are omitted. Existing project-wide profile/booking table RLS limitations still apply.

## Verification

Run from `ride-share-app`:

```powershell
npm test
npm run lint
npx next build --webpack
npx next start --port 3104
```

In another terminal:

```powershell
$env:CHAT_LIVE_TESTS = '1'
node fixtures/contacts/verify-live.cjs
```

The opt-in live script reads `.env` credentials, creates three synthetic student accounts, one
car, one ride, and bookings. It generates sign-in tokens without sending emails, tests profile
completion/editing, phone visibility on a pending request, accepted room access, public-profile
exclusion, and mobile overflow. Its `finally` cleanup removes tracked fixtures. Screenshots go to
ignored `.test-dist/contacts`. Requires installed Edge, or set `CHAT_TEST_BROWSER` to another
installed Playwright browser channel. `CHAT_TEST_BASE_URL` overrides the local app URL.

Automated regression: 387 tests passed, including profile validation, saved-photo preservation,
server-action enforcement, safe contact links, authorized room roster projection, and exclusion
of contact fields from historical message authors. TypeScript and the production build passed.

Live browser verification passed on 2026-09-21 against the configured hosted Supabase project.
Existing-profile completion/editing, pending requester phone visibility, accepted participant
contacts, public-profile exclusion, and 375px mobile overflow checks passed. Desktop/mobile
screenshots were visually reviewed. All synthetic fixtures were removed.
