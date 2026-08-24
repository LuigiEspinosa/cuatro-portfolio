---
title: 'Enumerate the deployed routing table on the box'
type: 'chore'
created: '2026-08-24'
status: 'in-review'
baseline_commit: '7e57ed2643d281a5fc5a3004ba4d82725f0ce507'
baseline_revision: '7e57ed2643d281a5fc5a3004ba4d82725f0ce507'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/ops/routing-inventory.md'
  - '{project-root}/ops/estate.md'
  - '{project-root}/ops/known-violations.md'
warnings: ['oversized']
deferred: []
operator_actions:
  - 'OPEN. Read the Cloudflare account audit log, then revoke the API tokens `tracker-mac` and `cuatro-tracker`. An agent cannot: the only token in the estate is zone-scoped, and on 2026-08-24 `GET /accounts/cd0752bce97437c466e4786a20ea6618/audit_logs` returned HTTP 403 `Authentication error` (code 10000) while `GET /user/tokens` returned HTTP 403 `Unauthorized to access requested resource` (code 9109). Reading the log needs an account-scoped token; revoking needs `User > API Tokens > Edit`. This story also carries a standing boundary never to revoke, rotate or create any credential. Already tracked as `ops/bot-mitigation.md` Pending Operator action 5.'
  - 'OPEN. Confirm `analytics.cuatro.dev` passes the Cloudflare managed challenge in a real browser. An agent cannot: a command-line client cannot solve a challenge and correctly receives 403 with `cf-mitigated: challenge`, Playwright is not installed until Story 1-10, and no acceptance criterion here may claim a rendered-output result. Already tracked as `ops/bot-mitigation.md` Pending Operator action 3.'
  - 'OPEN. Confirm in the Hostinger console whether the weekly whole-box snapshot that `cuatro-backup.sh` claims to complement actually exists, and if it does, record its retention and restore procedure under `ops/`. An agent cannot: no evidence of it exists on the box and the agent has no Hostinger console credential. This determines whether the estate has any offsite copy of anything at all.'
  - 'OPEN. Verify IPv6 serving for the three Satellite AAAA records and verify the v6 `DOCKER-USER` DROP path with one direct request to `2a02:4780:75:9155::1`. An agent cannot from here: no session so far, including this one, has had IPv6 egress. Until then the v6 rules are present and the path is unverified, which are different claims. Closing it also unblocks adding AAAA records for the apex, `www` and `analytics`.'
  - 'OPEN, and it is a Registry decision rather than a console action. Decide whether `analytics.cuatro.dev` gets an Estate row or whether infrastructure hostnames are declared outside the Registry, and resolve the same question for `covidmap.cuatro.dev` and `future-vizion.cuatro.dev`. An agent cannot: AD-3 makes the hostname a declared value and AD-6 governs membership, so this is Story 2-4 territory and a routing enumeration has no mandate to decide it.'
  - 'CLOSED BY IMPOSSIBILITY. Enumerate the old address `95.216.143.251` before decommissioning. Neither an agent nor the Operator can: the box no longer exists per the Operator statement of 2026-08-16 and 2026-08-17, no session ever held a credential for it, and no read path exists. Recorded in `ops/routing-inventory.md` as permanently unenumerable so nobody carries it as pending work.'
---

<intent-contract>

## Intent

**Problem:** The deployed routing table exists nowhere in source (forced change C-9). `docker/Caddyfile` carries the Anchor's three site blocks only, while six hostnames serve. `ops/routing-inventory.md` holds a partial record written during Story 1-21 for the Anchor's move, and it names five things it still owes: the three Satellite projects' internals, whether anything outside Docker reaches a hostname, each hostname against its AD-3 application id, a Cloudflare audit-log confirmation before either orphaned API token is revoked, and backup coverage per project. Epic 4's greenfield rebuild and Story 1-8 are both blocked on that missing half.

**Approach:** Run the read-only pass `ops/routing-inventory-checklist.md` was written for, off the box (Cloudflare zone read, external probes) and on the box over SSH, then fold the results into `ops/routing-inventory.md` so it becomes Story 1.7's complete record rather than Story 1-21's partial one. Retire the checklist's scaffolding once its findings have landed in the record.

## Boundaries & Constraints

**Always:**
- **Read only.** Nothing on the box, in the zone, or in any vendor console is changed by this story. No restart, no config edit, no `docker compose up`, no reload, no DNS write, no token revocation, not even to fix something obviously broken. A broken thing found is written down and left.
- SSH runs through `wsl -- ssh deploy@177.7.52.248`. Windows OpenSSH holds no key for the box and fails with `publickey`.
- Paste observed output into the record rather than a recollection of it. The record's value to Epic 4 is that it is evidence.
- Every value is marked as a decision or an observation, and the two are never presented as the same kind of fact (NFR-9). Anything not determined is written down as unknown rather than guessed.
- Dates and times are ISO 8601 UTC.
- Prose carries no em-dash, no en-dash used as a dash, no double-dash standing in for a dash, and no emoji. The commit is a subject line only, with no body and no trailer.

**Block If:**
- The box is unreachable over SSH and no read path to it exists. The on-box half is the story.
- A hostname in the zone serves something that contradicts `ops/estate.md` in a way that changes an application's disposition. That is a Registry decision and belongs to Story 2-4.

**Never:**
- Never write `sprint-status.yaml`.
- Never revoke, rotate or create any credential. The audit-log read needs an account-scoped token the agent does not hold, so it is an operator action.
- Never touch `/home/deploy/cs-tracker/Caddyfile`, the `DOCKER-USER` chain, `contracts/`, `content/projects.ts`, or any running container.
- Never edit inside the `bmad:context` markers in `AGENTS.md`. A stale pitfall line there is a `/bmad-project-context` refresh item, already recorded as deferred work.
- Never claim a rendered-output or browser check. Playwright arrives in Story 1-10, so the `analytics` managed challenge cannot be asserted from here.

**Handling, per case this pass is known to hit.** This story ships no code, so these are procedure branches rather than program I/O, and the Verification section is where they are checked.

- A zone record serving something that appears in no planning artifact is recorded in the inventory, never omitted. AD-6 forbids dropping by omission.
- A hostname in the zone that is not served from the box (`covidmap`, `future-vizion`, `_domainconnect`) is recorded with what is observable from outside, and every column that is not observable is written as unknown.
- An on-box command that would write is not run. One that fails is recorded with its error rather than retried with a different tool until it succeeds.
- A negative finding is a finding. If nothing outside Docker reaches a hostname, the record says so explicitly.
- Anything needing a vendor console or a credential the agent does not hold is recorded as an operator action, never assumed and never worked around.
- The old address `95.216.143.251` is recorded as permanently unenumerable, because the box is gone. It must not be left as pending work nobody can perform.

</intent-contract>

## Code Map

Gathered 2026-08-24. Off-box evidence is observed in this session; the on-box half is gathered read-only over SSH during execution.

- `ops/routing-inventory.md`, the deliverable. Before this story it was Story 1-21's partial record: the box facts, the six-hostname table, the shared-Caddy ingress, the deploy path, the box-only configuration set, and the live-credentials table. Its closing section, "What Story 1.7 still owes", was the exact work list this story closes.
- `ops/routing-inventory-checklist.md`, Story 1.7's method, written 2026-08-16 and **deleted by this story**. Part 1 was a pre-cutover DNS snapshot that had become wrong in every proxied column and still named the two-address topology. Part 2 was the on-box command set to run, and it is carried forward as the record's "How to re-gather this record" appendix rather than lost. Part 3 was the open-question list, most of which Story 1-21 and 1-3 had already answered. Its own header said to delete it or fold it in once the inventory landed. **No line-number citation into it survives in this spec**, because the file no longer exists.
- `ops/estate.md:83-99`, the fifteen-row disposition table. The source for the AD-3 mapping in both directions, together with `ARCHITECTURE-SPINE.md:98` (AD-3: the public hostname is declared per Registry entry, never derived from the id).
- `ops/known-violations.md`, a live register that cites `ops/routing-inventory.md` by line number in five places. Reordering the record invalidates all five, so this story amends them to heading anchors with dated line numbers, which is the shape that file's own "When a citation drifts" note prescribes.
- `ops/bot-mitigation.md:47-49,100-109,297-299`, the WAF rule set, the expected status codes for all six hostnames, and the outstanding operator rows. Row 5 already carries the audit-log read, so this story points at it rather than duplicating it.
- `docker/Caddyfile`, the Anchor's three site blocks only, a mirror of a region of the box file and read by no process. Do not infer routing from it.
- `_bmad-output/implementation-artifacts/deferred-work.md`, the append-only ledger. Two open entries are touched by this pass: the Cloudflare edge certificate needing watching, and the AAAA gap on the three moved hostnames. Entries this story itself wrote are corrected in place; entries written by other stories are not.
- `_bmad-output/planning-artifacts/epics.md:1349-1392`, Story 1.7's four acceptance blocks, as amended 2026-08-16. The mapping from those four blocks to this spec's seven acceptance criteria is below, because four and seven do not line up on their own.

**How `epics.md`'s four blocks map to this spec's seven acceptance criteria.**

| `epics.md` block | Lines | This spec's criteria |
|---|---|---|
| Block 1: one row per hostname per address, proxied state, `www` accounted for, unexpected hostnames recorded | `:1362-1374` | **AC 1** (the per-hostname row) and **AC 2** (proxied state, `www`, unexpected hostnames). One block, split in two because it carries two separately checkable obligations |
| Block 2: per address, what runs there and how each hostname reaches it, and which configurations exist only on a box | `:1376-1383` | **AC 3** |
| Block 3: AD-3, each hostname against the application id it serves | `:1385-1388` | **AC 4** |
| Block 4: NFR-2, the inspection is read-only | `:1390-1392` | **AC 5** |
| No block | n/a | **AC 6**, retiring the checklist. This story's own scope, not `epics.md`'s: the checklist did not exist when the epic was written |
| No block | n/a | **AC 7**, enumerating operator actions in frontmatter. A workflow convention, not an epic requirement |

**Which four subdomains NFR-2 means.** `epics.md:250-253` names them: `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and `library.cuatro.dev`, plus `list-wheel` on its current host, which is not in this zone. AC 5 checks six hostnames rather than four because the record enumerates six serving hostnames: NFR-2's four, plus `www.cuatro.dev`, which is a redirect with no application behind it, plus `analytics.cuatro.dev`, which is infrastructure with no Estate row. **Checking six satisfies the four-subdomain requirement and is stricter than it**, and the two extra hostnames are named here so a reader does not read the mismatch as a defect.

**Observed off the box, 2026-08-24, read-only.**

- Cloudflare zone `cuatro.dev` (id `e90c26d4127883f3b0a56d5932c500f5`, account `cd0752bce97437c466e4786a20ea6618`) holds **25 records, all 25 read**. Six A, three AAAA, three CNAME, five MX, four NS, four TXT. Every `cuatro.dev` A and AAAA record is proxied and points at `177.7.52.248`. That establishes the enumeration is complete today. It does **not** identify which record the 2026-08-16 reading missed, because the zone held 26 that day and `n8n.cuatro.dev` was deleted in between, so that gap closes as unrecoverable rather than as answered.
- Six hostnames probed with a browser user agent: `cuatro.dev` 200, `www` 301 to the apex, `analytics` 403 with `Cf-Mitigated: challenge`, `cs-tracker` 302, `tracker` 307, `library` 302. That is the baseline `ops/bot-mitigation.md:100` records, unchanged, and it held again at 2026-08-24T10:49:16Z after every read in this story had run.
- **The Cloudflare edge certificate rolled over.** All six present subject `CN = cuatro.dev`, SANs `cuatro.dev` and `*.cuatro.dev`, issuer `C = US, O = Google Trust Services, CN = WE1`, notBefore 2026-08-21T00:18:46Z, notAfter 2026-11-19T01:16:34Z. **That issuer string is pasted in the form `openssl x509 -noout -issuer` printed it, and the record uses the same form**, so the two files agree character for character. The prior observation was notAfter 2026-09-20T23:23:52Z, so renewal happened and the open deferred question is answered by observation. The 30-day interval is one observation and is not recorded as a cadence.
- **The checklist's wildcard question is answerable and is answered.** `GET /zones/{id}/ssl/certificate_packs?status=all` shows two Universal SSL packs created 2025-08-31 at zone activation, both covering `cuatro.dev` and `*.cuatro.dev`, both validated by `txt`: an active Google Trust Services pack and a Let's Encrypt **backup** pack last modified 2026-07-14T06:23:39Z. The 2026-07-14 wildcard is Cloudflare's own, so the inference that something held zone credentials is refuted rather than left open.
- Zone settings and rulesets read: `ssl strict`, `always_use_https off`, `min_tls_version 1.0`, no HSTS at the edge, four rulesets and none in a redirect or transform phase. The per-phase entrypoints and legacy Page Rules return 403 and are recorded as unknown.
- `covidmap` and `future-vizion` serve 200 from Vercel on single-name Let's Encrypt `YR1` certificates, DNS-only CNAMEs. Neither is in `ops/estate.md`; that gap is Story 2-4's and is already in the ledger.
- The zone-scoped token returns 403 on `accounts/{id}/audit_logs` and on `user/tokens`, so the audit-log confirmation is an operator action.

## Tasks & Acceptance

**Execution:**

- `ops/routing-inventory.md`: gather the on-box read-only pass over `wsl -- ssh deploy@177.7.52.248` and fold it in. This is the half Story 1-21 did not do. Cover, per compose project, its services, images, volumes, restart policy and what each container actually runs; whether any listener outside Docker holds 80 or 443 or reaches a hostname, checked across TCP, UDP **and** host NAT; and the backup coverage each project has today, which Story 1-8 reads for `digital-library`.
- `ops/routing-inventory.md`: reframe the file from Story 1-21's partial record to Story 1.7's complete one. Add the full 25-record zone enumeration with proxied state per record, extend the hostname table to every hostname in the zone including the ones that are not ours, add the 2026-08-24 external observation with certificate detail, read the zone's behavioural settings and rulesets as well as its records, and state plainly that this pass was read-only, with the real window rather than the interval between two probes.
- `ops/routing-inventory.md`: add the AD-3 mapping table in **both** directions, one row per hostname against the application id it serves and one row per Estate application id against a hostname or an explicit none. Epic 2 authors Registry `live` values from it and Epic 4 authors router definitions from it, and the reverse pass is what stops Epic 2 authoring a `live` value for a hostname that does not resolve.
- `ops/routing-inventory.md`: make the record reproducible for a rebuild. Capture each container's image id, resolve whether each image was built on the box or pulled, enumerate each project's declared services, volumes and networks from source and say where declared and running disagree, size every volume and bind mount, and record each `.env` file's variable names (never a value).
- `ops/routing-inventory.md`: replace "What Story 1.7 still owes" with a dated close-out. Each former item is either answered there, or named as an operator action with the reason it cannot be done by an agent. The old address `95.216.143.251` is recorded as permanently unenumerable rather than pending.
- `ops/routing-inventory.md`: make the record navigable and self-consistent. Add a contents list, an explicit statement of what would invalidate the record, and a review-by date; state each repeated caveat once and cross-reference it; and paste evidence in one consistent observed form rather than two.
- `ops/routing-inventory-checklist.md`: fold its findings into the record and delete it. Its Part 1 tables are a pre-cutover snapshot that reads as current state and is wrong in every proxied column, which is worse than absent. **Nothing it held that is still true may be lost**, and that includes its Part 2 command set, which becomes the record's re-gather appendix, and its Certificate Transparency wildcard finding, which gets an explicit disposition.
- `ops/known-violations.md`: amend the five line-number citations into `ops/routing-inventory.md` that this story's reordering invalidates. Amend in place with a heading anchor and a dated line number, never delete.
- `_bmad-output/implementation-artifacts/deferred-work.md`: append what this pass surfaced and what it closes. At minimum the observed edge-certificate rollover, and any finding on the box that is real but not this story's to fix. Entries this story wrote may be corrected in place; entries from other stories may not.

**Acceptance Criteria:**

- Given `docker/Caddyfile` routes only the Anchor's hostnames while six serve, when the box has been inspected, then `ops/routing-inventory.md` records for every hostname in the zone and every address it resolves to: the hostname, the serving address, what terminates TLS, what serves it, the container or process behind it, and the port, covering at minimum `cuatro.dev`, `analytics.cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and `library.cuatro.dev`.
- Given proxying determines what an external probe observes, when the record is written, then each DNS record is marked proxied or DNS-only, `www.cuatro.dev` is accounted for, and every hostname in the zone that nobody expected is recorded rather than dropped.
- Given the committed compose file describes a Caddy stack, when the discrepancy is investigated, then the record states per address what is actually running there and how each hostname reaches it, and states which of those configurations exist only on a box and in no repository, because that is the set Epic 4 must recreate.
- Given AD-3 makes the public hostname a declared value rather than a derived one, when the inventory is written, then each hostname is recorded against the application id it serves.
- Given NFR-2 requires all four subdomains to serve through every step, when the story closes, then the record states that the pass was read-only, and the six hostnames return the status codes `ops/bot-mitigation.md:100` records both before and after the pass.
- Given `ops/routing-inventory-checklist.md` is scaffolding whose Part 1 is now a stale snapshot, when the inventory lands, then the checklist is retired and nothing it held that is still true is lost.
- Given some remaining acceptance needs a vendor console the agent has no credential for, when the story closes, then each such item is enumerated in the spec frontmatter under `operator_actions` with the reason an agent cannot perform it.

## Spec Change Log

## Review Triage Log

## Design Notes

**Why the record and not a new file.** `ops/routing-inventory.md` is already the path four other documents point at, including `ops/known-violations.md` and `ops/bot-mitigation.md`. A second routing document would split the answer to one question across two files, which is the condition C-9 exists to end.

**The two halves are observed at different times, and the record must say so.** The box facts in the file today were gathered 2026-08-17 during a change window. This pass is 2026-08-24 and changes nothing. Where the two disagree, the newer observation wins and the older one is kept with its date rather than overwritten, because a rebuild reading this later needs to know which facts were stable across a week and which were not.

**Read-only means read-only, including through SSH.** `docker inspect`, `docker compose config`, `cat`, `ss`, `systemctl list-units` and `iptables -L` are reads. `docker exec` into a running container is a read only when the command it runs is one, and it is avoided where a `docker inspect` gives the same answer. Nothing in this story runs `up`, `restart`, `reload`, `pull` or any write.

## Verification

**Commands:**

The first two prove only that the tree is undisturbed. **The checks that matter for a story
whose whole output is prose are the third and fourth**, because the failure mode here is a
dangling reference, not a type error.

- `git grep -n "routing-inventory-checklist"`. Expected: hits **only** inside `done` spec files, which are historical records and are not edited. A hit in any `ops/` file, in a live spec, or in `AGENTS.md` is a dangling reference to a file this story deletes, and must be fixed.
- `git grep -nE "routing-inventory\.md:[0-9]"`. Expected: hits **only** inside `done` spec files. Reordering the record invalidates every line-number citation into it, and `ops/known-violations.md` is a live register that carried five. Each surviving live citation must name a heading and carry a dated line number that actually lands. Verify by opening the target line, not by assuming.
- `corepack pnpm typecheck`. Expected: passes. No source file changes, so this only proves the tree is undisturbed.
- `corepack pnpm test --run`. Expected: the full suite passes, unchanged count.
- `git diff --stat`. Expected: `ops/routing-inventory.md`, the deleted `ops/routing-inventory-checklist.md`, `ops/known-violations.md`, `_bmad-output/implementation-artifacts/deferred-work.md` and this spec, and nothing else.
- `wsl -- ssh deploy@177.7.52.248 "docker ps --format '{{.Names}} {{.Status}}'"`. Expected: the same container set, all `Up`, before and after the pass. **Read the uptimes, not just the status**: a container this pass restarted would read minutes rather than weeks, and `Up` alone would not show it.

**Manual checks:**

- Re-probe the six hostnames after the pass and confirm 200, 301, 403, 302, 307, 302. A different code means this pass changed something, which it must not have.
- Scan the `ops/` files this story touches, which after the change are `ops/routing-inventory.md` and `ops/known-violations.md`, for an em-dash, an en-dash used as a dash, a double-dash standing in for a dash, or an emoji, and confirm none is present. **The checklist is deleted, so there is no second file to scan there.** Scan this spec on the same rule, outside the `<intent-contract>` block and excluding CLI tokens such as `wsl -- ssh` and `git checkout -- pathspec`.
- Confirm every table row in the record carries a nature marker, decision or observation, and that no unknown has been rounded into a plausible value. **Pay particular attention to verdicts read off a script comment or a file listing**: those are inferences, and the record must either say so or open the artefact and observe.
- Confirm no value from any `.env` file appears anywhere in the diff. Variable names are recorded deliberately; a value would be a leak.
- Open the record's contents list and confirm every anchor resolves to a heading that exists.
