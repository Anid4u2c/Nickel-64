# Artist-owned setlist workflow

Status: proposed workflow and implementation handoff; no application migration or cloud deployment.
Prepared: 2026-11-26.

## Outcome and scope

An artist or band signs in, creates a workspace, brings their repertoire, and builds a performance-ready setlist for a gig. Clients and collaborators contribute within that workspace’s permissions. Nickel 64 is the first pilot.

Working assumption: build a reusable artist app from Nickel 64’s music behavior and PWA-Foundation’s infrastructure. Keep artist-specific branding and data configurable. This proposal does not select a new repository name, Firebase project or hosting address.

## Work backwards from the performance

The finished product is an ordered, readable running sheet: event, local date/time/timezone, sets, songs, arrangements, cues, breaks, and estimated finish time. It must work on a phone and print cleanly. Reading an explicitly downloaded performance copy offline is a separate capability from offline editing.

| Needed at the gig | Earlier workflow that makes it possible |
| --- | --- |
| Correct order and arrangements | Artist reviews, reorders and publishes a revision |
| Walk-in / first-dance cues visible without clicking | Client requests and artist performance instructions remain distinct, visible notes |
| A realistic running time | Song durations, set allocations, break lengths and an event timezone |
| The right people can contribute | Artist workspace membership and per-event client sharing |
| Songs available to choose | Artist-owned catalog with manual entry and import preview |
| A usable app | Foundation shell, Google sign-in, theme, install and selected backend setup |

## Artist journey

1. **Sign in and create your act.** Google sign-in leads to Create artist/band or accept an invitation. Enter act name, solo/duo/band, instruments and timezone; logo, bio and social links are optional. Create the workspace with the signed-in account as its initial owner. A person may belong to several acts; show the active act clearly.
2. **Build the repertoire.** Add title and original artist/composer; optional duration, year, BPM, key, instrumentation, arrangement notes and recording links. Offer a CSV import first. Preview field mapping, invalid rows and duplicate candidates before committing. Excel/Google Sheets adapters are later increments. Distinguish the original recording artist from the performing act. Different playable arrangements of a song can have different durations and keys.
3. **Create a gig.** Supply event name, date, timezone and quarter-hour start/end times. Venue and contact details are optional and private. Offer Blank setlist, Copy a past gig, or Use a template. Overnight schedules show the next-day ending explicitly.
4. **Build the running order.** Search the act’s repertoire and add songs; support keyboard/touch movement as well as drag-and-drop. Group into Set 1, Set 2 and encores; insert timed breaks. Show known music duration, breaks, remaining time and songs without durations. Do not present incomplete duration totals as reliable finish-time predictions.
5. **Add performance cues.** Show notes beneath song titles, with expandable long text. Quick labels start with Walk-in, First dance and Must play. Artist-authored instructions can capture arrangement, key, start/stop cue and who leads; client-authored notes remain separately attributed and read-only to the act.
6. **Invite collaborators or clients.** Band editors can build the artist’s running order. Clients can submit a wish list or event-specific requests; invited viewers can read. Requests are visibly pending until approved. Client edits must not silently overwrite a published performance order.
7. **Review and publish.** Resolve requests, missing timing and conflicting edits. Save a versioned performance revision; show what is still pending rather than treating it as approved. Share the chosen revision with the performers and clients at their permitted level. Later edits create a revised draft and an explicit new published revision.
8. **Perform and reuse.** Open the running sheet, print/download it, or explicitly save a private offline copy on a trusted device. After the gig, archive it and offer Copy as a new gig or Save as template. Copying excludes client identities, shares and client notes by default.

Empty states guide the artist through Add your first song → Create your first gig → Build your first set. A solo artist can complete the journey without inviting anyone or enabling client requests.

## Roles and note ownership

| Role | Catalog | Artist running order | Client requests / notes | Sharing |
| --- | --- | --- | --- | --- |
| Workspace owner | Manage | Create/edit/publish | Read and approve/deny requests; do not rewrite client notes | Manage workspace and events |
| Band editor | Edit | Create/edit; publish only if explicitly granted | Read and review within assigned access | No owner changes |
| Performer/viewer | Read permitted catalog | Read shared revisions | Read notes shared with the event | None |
| Event client/editor | Browse permitted repertoire | Propose choices in their event planning area | Add/edit their permitted event requests and notes | Only if granted event-manager rights |
| Event viewer | Browse permitted repertoire | Read shared revision | Read shared notes | None |

A workspace role never grants access to another act. Moderator preview changes presentation, not permissions. Replace hard-coded band email lists with verified UID membership and validated invitations. Ownership changes and invitations are explicit authorized operations; membership is not self-assigned from a browser-supplied role.

The current application intentionally makes moderator accounts read-only for client song notes. Preserve that policy for client notes while giving artists a separate performance-instruction field they own.

## Foundation versus music application

| Reuse from PWA-Foundation | Keep in the artist app |
| --- | --- |
| Navigation, light/dark/system themes, footer/social components | Artist branding, catalog, arrangements and recording links |
| Google sign-in/session handling and diagnostics | Workspace memberships, client sharing and note ownership |
| Install assets and composed offline worker | Gig/set/break model and performance screen |
| Selected Firebase adapters and cloud setup tools | Song requests, decisions, hearts and artist-specific rules |
| Tested deployment/build provenance patterns | Imports, migration and publication revisions |

Pin a reviewed Foundation commit and lock dependencies. Import independent modules, not the showcase. The minimal distribution documented today is Hosting-only and does not contain the complete auth/data integration needed here. Use a reviewed backend-enabled integration or explicitly extend the distribution; do not claim the minimal starter already supplies the artist workflow.

Foundation’s readiness document separates local verification from live acceptance. Google sign-in, private backend access, installation and offline behavior still need checks in this consuming app.

## Reuse and changes in Nickel 64

Retain: song search/filtering, validated recording links, ordering, date/time helpers, overnight duration, request matching by normalized title + artist, inline notes, quick note labels, sharing concepts, print/export, realtime updates, transaction conflict protection.

Change:
- One shared duo catalog → workspace-owned catalogs and arrangements.
- Client-owned event planner as the main entry → artist-owned gigs and running orders.
- Fixed moderator emails → explicit workspace membership and event permissions.
- All moderators seeing every setlist → members see only their workspaces and assigned events.
- One ordered song-ID list → stable setlist item IDs, including sets and breaks.
- Global song detail changes → catalog updates plus arrangement snapshots in published revisions.
- One undifferentiated note → client note and artist performance instruction.
- Per-account hearts tied to adding/removing across plans → decide whether hearts mean favorites or event demand before reuse. Never aggregate demand across unrelated artists.

Do not automatically import Nickel 64’s 103 songs, branding, accounts or client data into new artist workspaces.

## Suggested domain model

- workspaces/{workspaceId}: artist display name, branding, timezone, configuration.
- workspaces/{workspaceId}/members/{uid}: validated role and membership lifecycle.
- workspaces/{workspaceId}/songs/{songId}: original title/artist, metadata, status and links.
- workspaces/{workspaceId}/arrangements/{arrangementId}: song reference, key, instrumentation, duration and artist instructions.
- workspaces/{workspaceId}/gigs/{gigId}: event details, timezone, schedule and lifecycle.
- gigs/{gigId}/items/{itemId}: stable identity, song/arrangement reference or break, set, order and artist cue. Use workspace-scoped paths in implementation.
- gigs/{gigId}/clientPlans/{planId}: client selections, authored song notes and event-limited sharing.
- gigs/{gigId}/revisions/{revisionId}: immutable published snapshots and publication metadata.
- workspace invitations / request records: scoped target, expiry/status, verified acceptance and audit metadata.

Published revisions snapshot the necessary arrangement, timing and authorized cues, so later catalog edits do not silently change a performance. Store only data the recipient is permitted to read. A repeated song can appear twice with different item IDs and performance instructions. Details and display indexes must not be used as song/item identity.

This is a proposed schema, not implemented rules. Validate it with emulator tests before provisioning or migrating data.

## Sync and offline contract

Keep edits locally when saving fails, show unsynced state, and offer retry/reload. Use revision checks to reject competing order or detail overwrites. A note’s edit state must survive unrelated realtime updates.

Initially support the public shell offline. Add private performance downloads only through an explicit user action with visible availability/last-synced state, account/workspace separation, sign-out cleanup and a remove-download action. Use one composed worker. Do not cache authenticated Firestore responses through a general shell cache, or claim offline edits will merge automatically.

## Delivery sequence and acceptance

1. **Foundation-backed shell and act onboarding.** Act selection, Google sign-in, theme and install integration. A new artist can create a workspace without inheriting Nickel 64 data. Verify on mobile.
2. **Artist catalog and one-gig builder.** Manual catalog, CSV preview, gig schedule, repeatable item IDs, sets/breaks, visible notes and running-time warnings. A solo artist can build and print a complete setlist.
3. **Collaboration and requests.** Member invitations, event-only client access, separate client notes and artist cues, request review and safe realtime conflict handling. Cross-workspace and cross-event reads/writes must be denied in tests.
4. **Publication and performance mode.** Immutable revisions, readable mobile running sheet, controlled sharing and downloads. Editing the repertoire must leave a published revision unchanged.
5. **Pilot and migration.** Pilot with synthetic data, then explicitly select Nickel 64 records for migration. Preserve IDs/owners/shares, produce a mapping and reconciliation report, test reruns, retain a backup and rollback route. Existing database edition/name/region must be inspected rather than replaced by Foundation defaults. Move production only after validation.
6. **Offline private copies and templates.** Verify trusted-device storage, stale-state warnings, logout cleanup, copy privacy and physical-device installation before advertising these features.

Minimum scenario checks: empty artist workspace; two acts with no data leakage; solo artist without clients; shared performer read-only; revoked invite/access; duplicate import; same song twice; missing duration; overnight/DST scheduling; client note untouched by band edits; concurrent reorder; request still pending; catalog edited after publication; print long notes; failed sync; offline copy and sign-out cleanup.

## Evidence reviewed

Nickel 64 source: 5410ef8a010a9704a24bac4cf2b7bc86ea9d8db7.
Foundation source: 0e7cbcfa5ed5ad649c97cc42b7e8ef01b528f470.

- [Nickel 64 README](https://github.com/Anid4u2c/Nickel-64/blob/5410ef8a010a9704a24bac4cf2b7bc86ea9d8db7/README.md)
- [Nickel 64 plan model](https://github.com/Anid4u2c/Nickel-64/blob/5410ef8a010a9704a24bac4cf2b7bc86ea9d8db7/dist/plan-model.js)
- [Foundation README](https://github.com/Anid4u2c/PWA-Foundation/blob/0e7cbcfa5ed5ad649c97cc42b7e8ef01b528f470/README.md)
- [Foundation module inventory](https://github.com/Anid4u2c/PWA-Foundation/blob/0e7cbcfa5ed5ad649c97cc42b7e8ef01b528f470/docs/MODULES.md)
- [Foundation minimal starter boundary](https://github.com/Anid4u2c/PWA-Foundation/blob/0e7cbcfa5ed5ad649c97cc42b7e8ef01b528f470/docs/MINIMAL-STARTER.md)
- [Foundation readiness](https://github.com/Anid4u2c/PWA-Foundation/blob/0e7cbcfa5ed5ad649c97cc42b7e8ef01b528f470/docs/READINESS.md)

Reviewed documentation and the existing plan model; this is not an exhaustive source audit or an implementation. No private song notes were accessed for this workflow.
