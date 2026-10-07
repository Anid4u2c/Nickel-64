# Nickel 64 Songbook

Event setlist planner for **Nickel 64**, Dave Carlson (guitar) and Rob Patterson (violin). The header remains **N64 SONGBOOK**.

## Live apps

- Firebase: https://nickel-64.web.app
- Private ChatGPT Sites review: https://n64-songbook.anid4u2c.chatgpt.site

Browse 103 songs, search/filter the library, order a setlist, record an event date and start/end times, and print or download the plan. End times before start times finish on the following day; equal times are rejected. The event duration measures clock time, separately from the estimated total playing time of selected songs. Times are local to the event; the calendar date is stored as UTC midnight, independently of browser timezone.

## Shared setlists

Sign in with Google or email/password. Email/password users must verify their email before saving. Click **Save for Nickel 64** to create a shared setlist. Thereafter additions, removals and order changes sync automatically, including removal of the final song. **Save event details** is enabled only for unsaved event name, date, time or notes; it has a tooltip explaining this distinction. Song-only transactions preserve stored event details and reject competing song edits. Failed syncs keep the local draft and offer retry or reload. Detail updates from others are merged into untouched fields; competing edits require resolution.

Regular users automatically open their single owned/shared setlist when there is no separate unfinished draft. Clicking the currently open card preserves local edits without a warning. An intentionally new draft stays open. Verified users see requested songs in the main library, with awaiting-review or denied labels, as well as in the request section.

- Clients read their owned setlists and those explicitly shared with their verified email.
- Verified `davecarlsonguitar@gmail.com` and `thenickel64@gmail.com` accounts can view all saved setlists.
- Verified app owner `nick@itness.ca` can also view all saved setlists.
- Owners can add, change and remove email-based shares: **Can edit** (default), **View only**, or **Additional owner**. Editors change the setlist; additional owners also manage sharing. The original creator retains immutable ownership. Up to 25 collaborators may be added.
- Moderator accounts can toggle between the duo’s all-setlists view and a regular view showing only their owned/shared records. This changes the displayed experience without impersonating another account.
- Saves use transactions with an expected update timestamp to reject concurrent overwrites. Reopen the latest saved record if a restored device draft cannot be saved.

Records live in the **`setlists` named database**, Firestore Enterprise Native mode, Toronto (`northamerica-northeast2`), with realtime updates enabled. Realtime queries are used so the duo's inbox receives clients' saves immediately. Security Rules enforce verified identities, fixed ownership, exact schema, song IDs, field-size limits, server timestamps and derived duration. No setlist data is publicly readable.

## Song requests and hearts

Verified users can request a song with title and artist; BPM, year and duration in seconds are optional. Partial title matches show existing repertoire and requests. Normalized title + artist identifies a request, so matching requests are reused and another artist is a separate entry. Requests can be included in a setlist while awaiting a decision; their status appears in the planner and exported text.

Moderators approve, deny and edit details. Approved songs join everyone's repertoire immediately. Denied requests remain visible to signed-in users and can be supported with a heart. Adding a song also gives it one heart per verified account; repeat additions do not inflate the count. Hearts are permanent expressions of interest, independent of subsequent removal from a setlist.

The shared `songCatalog` holds repertoire, requests, decisions and counts. Individual vote documents are private and immutable. Atomic transactions and rules enforce one vote per account. Realtime listeners propagate details and decisions immediately; title search filters the realtime catalog. The deployment imports the original 103 songs once and preserves moderator edits and votes on subsequent deploys.

## Deployment

The `Test and deploy Nickel 64` GitHub Action runs model and Firestore emulator tests, checks and deploys rules/indexes, configures sign-in domains/email authentication, and deploys the static app to Firebase Hosting. It uses the existing **`FIREBASE_SERVICE_ACCOUNT`** secret; no administrative key is included in the source or browser. Firebase web configuration is public.

Google sign-in is already enabled in the project. The domain script preserves existing authorized domains and Google provider configuration. It adds the Firebase and ChatGPT Sites domains.

Pushes to `main` deploy automatically; the workflow can also be run manually. Firebase app files are in `dist/`. ChatGPT Sites has its own source repository and publication flow, so it is republished separately.

## Checks

```sh
npm ci
npm test
npx -y firebase-tools@latest emulators:exec --only firestore --project demo-nickel-64 'npm run test:rules'
```

The rules tests cover client isolation, the duo's view access, denial of unverified accounts, immutable ownership and timestamps, schema pollution, malformed schedules, invalid song IDs and oversized writes. Browser interaction checks covered mobile layout, overnight schedules, shared-save success/failure, and viewing another client's record using a mocked cloud service. Live sign-in with Rob and Dave's accounts has not been performed.
