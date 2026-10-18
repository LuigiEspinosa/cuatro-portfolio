# Operator rulings, 2026-10-18

Source: given in conversation by the Operator (Luigi) on 2026-10-18, on the question table in section 4 of
`epic-9-plan-2026-10-18.md`, in his words: "all recommended, qBittorrent stays, no demo upload, keep sign-in
deferred". So every row's Recommendation column is the ruling, with three exceptions he named: DW-186 (qBittorrent
stays), DW-287 (no demo upload now) and DW-335 (the sign-in rework stays deferred). The earlier rulings of the same
day, recorded in `sprint-status.yaml` comments by `5b6ad75`, are listed at the end so this file holds every ruling of
the day. Stories 9-33 to 9-40 are the plan's conditional stories that these rulings open; their keys are not on the
board yet.

## Section 4 rulings

| Q | Question | Ruling | What it does next |
|---|---|---|---|
| DW-1 | How does `contracts/` identify itself to a vendoring repository? | (a): a provenance and licence line in the generated headers. Check first whether the vendored-copy comparison is byte-exact, since then it also needs a cs-tracker re-vendor. | Opens story 9-39-contracts-provenance |
| DW-4, DW-7 | Run the two follow-up reviews? | Run both. | Opens stories 9-11-contract-purity-followup-review (DW-4) and 9-14-anchor-step1-followup-review (DW-7) |
| DW-5 | 1-15 follow-up review? | Close as accepted: 1-19 executed the decision and the probe re-ran green twice. | Closes the entry |
| DW-18 | 1-20 follow-up review? | Close as superseded: 23 rewrites of `contract-adoption.md` since. | Closes the entry |
| DW-13 | Review 1-18's surviving roughly 124 test lines? | No. The entry stays closed and nothing folds into 9-14. | Nothing (already closed by `2069214`) |
| DW-21 | Confirm the spellings | `NestJS`, `Email Development`, `JavaScript`, `TypeScript`, as listed. The vocabulary pin is out of scope. | Opens story 9-16-cv-tech-spellings |
| DW-6 | Widen the pixel baseline to `/cv` and the 404 now? | Go, after 9-12. | Opens story 9-17-cv-and-404-baselines |
| DW-59 | Already resolved? | Keep open, folded into 9-4 (the status-mark row, three readings, file count 24). | Stays open for story 9-4-ops-record-pins |
| DW-148 | Already resolved? | Keep open: 9-26, then 9-27 (unique alias). | Stays open for stories 9-26-cs-tracker-unique-alias and 9-27-routing-headers-and-alias |
| DW-188 | Superseded? | Narrow to the header half: 9-27 with a SAMEORIGIN house-headers variant, matching the app's `frame-ancestors 'self'`. | Stays open, narrowed, for story 9-27-routing-headers-and-alias |
| item-4 | Where do the `secret_key_base` and Twilio rows land, now that KV-2 is retired? | Beside § Sources tolerated in `registry-verification.md`. | Opens story 9-3-cs-tracker-secret-key-base-record |
| item-5 | How to resolve UX-DR49 (non-3D path at most 140 KB) against the measured breach? | File a KV naming `/work` and `/cv` over budget, with DW-120 as part of the closer. The requirement is not restated. | A KV row in `ops/known-violations.md`, written by the story that takes it (no key yet) |
| item-10 | 2-27 is marked `done` before its screen-reader read | Do the read of `/` (Narrator or NVDA), record it in `hub-accessibility-pass.md` action 4, then the doc-only reconcile in 9-2. | Operator console step (the read), then story 9-2-process-rules-into-instruction-files |
| DW-290 | Where does the signed-in indicator go? | The footer link becomes "Signed in as <name>" plus sign-out, with an admin link for admins. R21 sign-off covers it. | Stays open for story 9-23-tournament-signed-in-state |
| DW-92 | Cloudflare Web Analytics beacon | Turn it off in the dashboard (NFR-8 allows first-party Umami only), and record it. | Operator console step, then a record |
| DW-130 | ssh-action fetches an unchecksummed binary | Replace it with a plain `ssh` step and a pinned known_hosts. | Opens story 9-33-replace-ssh-action |
| DW-136, 137, 138, 242 | Correct the stale planning lines? | Correct them with dated amendment notes. | Stay open for story 9-1-records-and-planning-sweep |
| DW-143 | The AD-17a gate is prose only | Declare it honour-system in `monitoring.md`. Nothing consumes the line. | Closes the entry (the declaration is in `ops/monitoring.md` § The parse contract) |
| DW-147 | Zone leftovers (Google NS, `_domainconnect`, ProtonMail TXT) | Delete all three after confirming the live mail provider is Google. | Operator console step |
| DW-150 | No HSTS anywhere | Add it at Traefik house-headers: max-age 6 months, no preload, no includeSubDomains at first. | Stays open for story 9-27-routing-headers-and-alias |
| DW-151 | No origin AAAA records | Accept: the records are proxied and the edge already serves IPv6. | Closes the entry |
| DW-159 | No Umami uptime monitor | Add one on `/api/heartbeat`, with a bot-rule allowance. | Opens story 9-37-analytics-monitor (with an Operator console step) |
| DW-163 | No warning before the edge certificate expires | Configure Rule 2, or a Cloudflare certificate notification. | Operator console step |
| DW-164 | The AI-crawler block relies on self-declared user agents | Turn on Cloudflare's native AI-crawler block. | Operator console step |
| DW-165 | Authenticated Origin Pulls never evaluated | Evaluate it before 9-28. | Stays open with trigger: before story 9-28-cloudflare-range-refresh |
| DW-168 | Dated commitments have no surfacing mechanism | Put calendar entries in the record, then close. DW-164 takes the overdue action. | Stays open until the calendar entries are in the record |
| DW-183 | Residual stores with no backup | Redis and qBittorrent state are disposable. The Origin CA goes to 9-31. | Stays open, narrowed to the Origin CA, for story 9-31-origin-ca-record |
| DW-185 | Satellites still build on the box | CI-built ghcr images for each Satellite, list-wheel first. | Stays open; list-wheel goes first in story 9-30-list-wheel-off-box-build |
| DW-186 | qBittorrent and Monarx on the box | qBittorrent stays (Operator, overriding the recommendation to decide later). Monarx is a knowing keep if Hostinger provides it, which is unverified until observed. | Stays open with trigger: the Operator observes Monarx's provenance in the Hostinger console |
| DW-193, DW-315 | Cron failures and nightly logs reach nobody | Reuse demo-reset's issue-opening pattern in each backup job. | Opens story 9-36-backup-job-reporting |
| DW-222 | The hit-target sweep counts inert and opacity-0 controls | Skip `inert` subtrees only, and keep opacity 0 counted. | Stays open for the story that edits the sweep (no key yet) |
| DW-238 | The estate lists are not held against DESIGN.md or EXPERIENCE.md | A stated non-goal: the Registry is the source of truth. | Closes the entry |
| DW-247 | Line-number citations to planning docs have drifted | Item 13's rule lands in 9-2. DW-247 stays open as the owner of a later backfill. | Stays open with trigger: a later backfill story |
| DW-253 | Build telemetry is on in the Hub and finance images | Disable it. | Opens stories 9-34-telemetry-off-hub and 9-35-telemetry-off-finance |
| DW-260 | The Hub carries three names | Record the mapping in an AD-3 amendment, with no rename of `anchor-app`. | Stays open for the AD-3 amendment (no key yet) |
| DW-261 | `.env.example` is stale | The Operator edits the two lines. Agents never read the file. | Operator step (local file edit) |
| DW-270 | Optional peers leak into the Hub's lockfile | Accept. | Closes the entry |
| DW-275 | The tracker and tournament roll by hand | Open the per-id deploy epic. It also closes DW-291 and DW-292. | Opens story 9-40-per-id-deploy |
| DW-287 | The Go worker has no public route | No demo upload is needed now (Operator). The authenticated route waits for the first real upload. | Stays open with trigger: the first real demo upload |
| DW-314 | The zone still accepts TLS 1.0 | Set minimum TLS 1.2 in the zone. | Operator console step |
| DW-335 | No sign-in page names demo@cuatro.dev | Keep it deferred (Operator, overriding the recommendation to schedule it). The 2026-10-06 ruling stands. | Stays open with trigger: the Operator's sign-in rework |
| DW-339 | digital-library runs a duplicate test workflow | Remove it. | Opens story 9-38-digital-library-drop-test-workflow |
| DW-75 | A cached `/cv` 308 in some browsers | Won't fix. The entry allows it. | Closes the entry |
| DW-134 | The R2 token's real rights | Read it, add a bucket lock on `digital-library/` if offered, and record both as Observed. | Operator console step, then a record |
| DW-160 | The zone-edit token's expiry | Set an expiry if none, and record the date in `routing-inventory.md`. | Operator console step, then a record |
| DW-189 | Unrecorded credentials in box `.env` files | Revoke the dormant Hetzner DNS token, confirm the SMTP account, then a Satellite PR drops digital-library's edge-profile caddy service. | Operator console step, then a Satellite PR (no key yet) |
| DW-190 | qBittorrent WebUI password and bind address | Read it on the box, then fix it in 9-32. | Operator box step, then story 9-32-tracker-redis-qbittorrent-home |

## Earlier rulings of the day

| Q | Question | Ruling | What it does next |
|---|---|---|---|
| Epic 6 | Do 6-2, 6-3, 6-4 and the retrospective start? | They stay backlog until the contract-adoption count reaches three (re-taken at 1 of 3, `0f35438`). | Stays open with trigger: the count reaches three |
| Epic 7 | Relocate the repositories into WSL2? | Out of scope, never executed. The runbook `epic-7-wsl2-relocation-runbook.md` stays as a record only. | Closed (`5b6ad75`) |
| epic-2 item 4, Twilio half | The Twilio API key that signed the expired 2021-04-16 token in Mutuo `72c7edf` | Gone with the Twilio account, which no longer exists. | Closed (`5b6ad75`); the `secret_key_base` half goes to story 9-3 |
| This run | May the Epic 9 run file new deferred-work entries? | No new deferred-work entries in this run. | Standing rule for the run |
