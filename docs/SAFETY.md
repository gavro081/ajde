# Safety, privacy and impact assumptions


Implemented protections:

- Magic-link requests and sessions are restricted to exact configured student domains.
- Protected routes are checked in the Next.js proxy before rendering.
- Onboarding requires a real name, university, and JPEG/PNG/WebP profile photo up to 5 MiB.
- Storage policies restrict profile-photo writes to the authenticated user's UUID folder.
- Public profile queries select only name, photo, university, bio, and gender—not contact fields.
- Ride creation and post parsing check the Supabase session on the server.
- Every booking mutation rechecks authentication, ownership, current state, departure time, and
  capacity; the database trigger is the final concurrency guard against overbooking.
- Applicants and public feed users never receive contact fields. Contacts are queried and shown
  only for accepted bookings to the participating driver and passenger.
- Same-gender discovery and booking restrictions require both people to have a declared usable
  gender; undisclosed or missing values are never guessed or treated as a match.
- Ride Q&A requires an authenticated complete student profile, accepts posts only before departure
  on published/full rides, and lets authors delete only their own comments.
- Share links use random bearer tokens, are available only for accepted bookings, can be revoked,
  and stop resolving after cancellation, booking-status changes, or 24 hours after departure. The
  public projection contains itinerary, driver name/photo, and car details—not contacts, booking
  messages, passenger identities, or live location.
- Imported records and saved cars are checked against the authenticated user's ID.
- Form input is validated in the UI contract and again in the Server Action.
- Duplicate submissions are detected through a submission UUID.
- Imported model output always goes through human review.
- Public Supabase keys are separated from server-only secrets.

## CO2 impact assumptions

The homepage shows database-derived estimated CO2/fuel savings, distinct participants, and completed
shared trips. It excludes rides marked `details.demo_seed`, counts only departed completed rides
with accepted bookings, and labels estimates and unavailable data explicitly. Participants count
each driver/passenger once across qualifying trips; missing/unsupported vehicle data excludes a
trip from savings estimates but not participation counts. No tree-equivalent estimate is shown.

- Each accepted passenger seat is assumed to replace a separate car making the same trip with the
  shared car's recorded consumption. These are estimates, not measured emissions.
- Personal savings belong to accepted passengers; drivers receive no extra credit. Each eligible
  ride contributes once to the platform total.
- Only departed rides explicitly marked completed and containing accepted seats qualify. Petrol
  and diesel use the factors above; missing/invalid distance, car, or consumption data and other
  fuels are counted as excluded rather than estimated.
- Totals use the currently stored ride, booking, and car data rather than an immutable historical
  snapshot, so later booking changes can alter the totals.

## Post-ride feedback

Once a driver marks a ride completed, accepted passengers can rate that driver in My trips,
and the driver can rate each accepted passenger in the driver dashboard. Requested, declined,
cancelled, unrelated, and passenger-to-passenger pairs are ineligible. Unclaimed rides have no
driver to rate. Each ride/rater/ratee pair contributes once, even for a multi-seat booking;
the database unique constraint resolves concurrent submissions.

Scores are integers from 1 to 5. Optional feedback is trimmed and limited to 1000 characters.
Submitted ratings become read-only. Public profiles show only the average to one decimal and
the count, or an honest empty state. The aggregate function excludes ineligible legacy rows.
Raw scores and notes are readable only by the rater and ratee; the dashboard shows the signed-in
user's submitted feedback as escaped text. Received-feedback UI, edits, deletion, appeals,
moderation UI, and AI spam/safety screening are deferred.

## Ride rooms and Realtime

Each ride has one room shared by its driver and currently accepted passengers. Passengers can
read messages created at or after their accepted booking's `decided_at`; the driver sees the
whole room history. Cancelling a booking immediately removes database read/send access.
Previously delivered text cannot be recalled. The client rechecks membership on reads, sends,
events, reconnect, focus, and periodically while open.

Sending is allowed until 48 hours after departure, inclusive, and stops when a ride is cancelled.
Completed rides inside the window can still receive messages. Authorized members keep read-only
history after cancellation or expiry. Direct messages, edits, deletes, read receipts, and AI
processing are deferred. Realtime events trigger an authorized history refresh.

Apply the migrations in order, including `20260921140000_communication_reputation_policies.sql`
and `20260921190000_rating_input_grants.sql`. The first publishes `public.messages` through
`supabase_realtime`; Realtime must also be enabled in the Supabase project. Use normal authenticated
student sessions and the existing public project key. The second narrows rating insert columns
and enforces private-note input without changing room permissions. No admin key is used by
the application for chat or ratings. See the linked verification guides for repeatable checks.


## Related guides

- [Database model](../ride-share-app/supabase/DATABASE_MODELS.md)
- [Ride-room setup and verification](../ride-share-app/fixtures/chat/README.md)
- [Rating verification](../ride-share-app/fixtures/ratings/README.md)
