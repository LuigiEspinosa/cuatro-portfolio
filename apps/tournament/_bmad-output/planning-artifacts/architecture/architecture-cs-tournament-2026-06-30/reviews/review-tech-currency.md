# Tech-Currency Review — ARCHITECTURE-SPINE.md (InclusivCup CS2)

- **Spine reviewed:** `_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md`
- **Review lens:** Pre-handoff gate. Verify every committed technology decision was web-researched / reality-checked rather than asserted — current versions, that each named tech still exists and fits, and live defaults of anything it leans on. Flag anything that could be stale and was not confirmed.
- **Review date:** 2026-06-30 (mid-2026 context)
- **Verdict:** **CONCERNS** — every bound technology exists, is current, and is correctly capability-matched; versions all check out against the live web. One cost figure (Railway) is optimistic and rests on an unstated low-utilization assumption; one storage-fallback note (Supabase 50MB cap vs demo size) deserves an explicit caveat in the build doc.

All versions in the Stack table and prose were independently re-verified against authoritative sources below. None had moved or been renamed/deprecated. Findings are about *framing/assumptions*, not wrong tech.

---

## Per-item verification

### 1. Next.js 16.2.x + Node 20.9+ baseline — **PASS**
- Latest stable is **16.2.x** (npm reports 16.2.7 current stable, June 2026). Next.js 16.2 released **2026-03-18**; it is a real, shipped release.
- Next.js 16 raised the **minimum Node.js to 20.9+**, carried through the 16.x line. The spine's `16.2.x (Node 20.9+)` is accurate and current.
- App Router (the spine's chosen router) is the mainline, fully supported router in 16.x.
- Sources:
  - https://nextjs.org/blog/next-16-2 (release blog, publishedAt March 18th 2026)
  - https://nextjs.org/docs/app/guides/upgrading/version-16 (Node 20.9 minimum)
  - https://www.npmjs.com/package/next (current stable 16.2.x)

### 2. Node 20.9+ as the floor — **PASS**
- Confirmed as the Next.js 16 minimum. 20.9 is an LTS-line version and is a valid, current floor in mid-2026. No deprecation concern. (Same sources as item 1.)

### 3. Go 1.26.x (worker) — **PASS**
- Go **1.26** released **2026-02-10**; latest patch **1.26.4** released **2026-06-02**. `1.26.x` is real, stable, and current.
- Comfortably satisfies demoinfocs-golang v5's Go 1.24+ floor (item 4).
- Sources:
  - https://go.dev/blog/go1.26
  - https://go.dev/doc/devel/release

### 4. demoinfocs-golang **v5.2.0** (pinned) — **PASS** (active, CS2/Source-2, per-tick positions all confirmed)
- **Active?** Yes. Latest release **v5.2.0**, published **2026-04-21**. Steady cadence through 2026 (v5.0.5 Dec 2025; v5.1.0 Jan 14 2026; v5.1.2 Jan 23 2026 — a fix for high memory after a CS2 update; then v5.2.0). Repo is `markus-wa/demoinfocs-golang` — same author/module, not renamed.
- **CS2 / Source 2?** Yes. The library is explicitly "a feature-complete Go library for parsing and analysing of Counter-Strike 2 and CS:GO demos," including live CSTV+ for CS2.
- **Per-tick positions?** Yes. Player positions are exposed via `GameState().PlayingParticipants()` and the `Player.Position()` (`r3.Vector`); the per-tick/per-frame cadence is driven by the `FrameDone` event. This directly supports the spine's AFK/idle position-sampling requirement (FR-21).
- **Go version:** requires **Go 1.24+** — satisfied by the worker's Go 1.26.x.
- Note for build: the spine pins v5.2.0, which is correct discipline (AD-1/AD-3 require a pinned parser_version for reproducible re-parse). v5.1.2 specifically fixed a post-CS2-update memory regression, so pinning to >= v5.2.0 is the right floor.
- Sources:
  - https://github.com/markus-wa/demoinfocs-golang/releases (v5.2.0, 2026-04-21)
  - https://pkg.go.dev/github.com/markus-wa/demoinfocs-golang/v5 (Go 1.24+, CS2/Source 2)
  - https://github.com/markus-wa/demoinfocs-golang/blob/master/pkg/demoinfocs/common/player.go (Position)
  - https://github.com/markus-wa/demoinfocs-golang/blob/master/pkg/demoinfocs/events/events.go (FrameDone)

### 5. Supabase free tier — **PASS** (with a build-doc caveat on the storage fallback)
- **Concurrent realtime connections:** Free plan ceiling is **200 concurrent peak connections**. The spine's operational note ("free-tier realtime concurrency ~hundreds … ample for 8-16 players + private audience") is accurate and the scale is comfortably within budget.
- **Realtime messages:** 2M/month, 256KB max message size — fine for a post-commit "nudge" pattern.
- **50MB file cap:** CONFIRMED. On Free projects the **global file size limit cannot exceed 50MB per file**; total free storage is 1GB. This is exactly why AD-16's decision to route 50-170MB demo bytes to **R2 (not Supabase Storage)** is correct. CAVEAT: the spine's `DemoStore` lists "Supabase-Storage swappable" as a fallback backend — on the free tier that fallback **cannot hold a typical demo** (most exceed 50MB). The build doc should note the Supabase-Storage impl is viable only for small demos / paid tiers, so nobody treats it as a drop-in failover for the primary R2 path.
- **Postgres version:** spine says "Postgres 15+"; Supabase provisions Postgres 15+ on current free projects — accurate (and the spine wisely uses `15+` rather than pinning).
- Sources:
  - https://supabase.com/docs/guides/realtime/limits (200 concurrent connections)
  - https://supabase.com/docs/guides/storage/uploads/file-limits ("For Free projects, the global file size limit can't exceed 50 MB")
  - https://supabase.com/pricing

### 6. Supabase Realtime — Broadcast vs Postgres Changes choice — **PASS** (choice matches current best practice)
- The spine deliberately uses **Realtime Broadcast** (server-emitted, post-commit nudge) and explicitly does NOT depend on Postgres Changes. This matches the 2026 Supabase guidance: Postgres Changes re-checks RLS per change per subscriber and has a known scaling cliff on hot tables; Broadcast is the recommended path for scalable, low-latency event fan-out. The spine's AD-11 ("Broadcast is a nudge, not the source of truth; every surface reconstructable from a published read") is the textbook-correct pattern and avoids the Postgres-Changes pitfall entirely.
- Sources:
  - https://supabase.com/docs/guides/realtime/broadcast
  - https://supabase.com/docs/guides/realtime/postgres-changes
  - https://supabase.com/docs/guides/realtime/benchmarks

### 7. Vercel ~4.5MB function body cap — **PASS**
- Confirmed current: max request/response body of a Vercel Function is **4.5MB**; exceeding it returns `413 FUNCTION_PAYLOAD_TOO_LARGE`. Vercel docs reaffirmed this in Feb 2026. This validates AD-16's central constraint — demo bytes (50-170MB) must never transit a Vercel function; presigned-multipart-to-R2 + small notify call is the correct workaround Vercel itself recommends.
- Sources:
  - https://vercel.com/docs/functions/limitations
  - https://vercel.com/docs/errors/FUNCTION_PAYLOAD_TOO_LARGE
  - https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions

### 8. Cloudflare R2 (S3-compatible, free egress, multipart, no native TUS) — **PASS** (every clause verified)
- **S3-compatible:** Yes — R2's S3 API lets existing S3 SDKs/tooling work unchanged.
- **Free egress:** Yes — egress via Workers API, S3 API, and r2.dev incurs **zero data-transfer charges**. Still current in 2026.
- **Multipart + presigned URLs:** Yes — multipart uploads, pre-signed URLs, and bucket policies all function as expected (S3 SDKs auto-multipart over a threshold). Directly supports AD-16's "R2 presigned multipart" web-upload path.
- **No native TUS:** Confirmed — R2 documents multipart and presigned URLs but no native TUS resumable-upload protocol. The spine's "no native TUS" is accurate; using S3 multipart for resumability is the right call.
- Sources:
  - https://developers.cloudflare.com/r2/pricing/ (free egress)
  - https://developers.cloudflare.com/r2/objects/upload-objects/ (multipart, presigned)
  - https://www.cloudflare.com/products/r2/ (S3-compatible, zero egress)

### 9. Railway Hobby "~$5-10/mo for an always-on small Go worker" — **CONCERNS (cost figure optimistic)**
- **Plan exists / price:** Yes — Hobby is **$5/month including $5 of usage credit**; usage beyond that is pay-as-you-go with **no hard spend cap**.
- **Billing model:** Railway bills **actual consumed** CPU/RAM per-second (billed in 1-minute increments) at **$20/vCPU-month and $10/GB-RAM-month**. It does **not** scale-to-zero in production (idle/app-sleep is for non-prod environments only) — a *running* container is billed for the resources it consumes even when not serving requests.
- **The concern:** The widely-cited reference point is "1 vCPU / 1GB running 24/7 ≈ $30/month." The spine's "$5-10/mo" is achievable **only if** the Go worker averages well under ~0.25 vCPU and ~0.5GB RAM. That is plausible for a worker that is idle (near-zero CPU) most of the time and only spikes during the occasional parse — and Railway *does* bill actual usage, not reserved capacity, so a mostly-idle worker can land in that range. But the figure is sensitive to (a) memory floor of a loaded demoinfocs parse (demos are 50-170MB; v5.1.2 existed specifically because parsing memory spiked) and (b) whether the process holds a vCPU reservation while idle. The "$5-10" was stated without an explicit utilization assumption.
- **Fix:** In the build/handoff doc, state the assumption explicitly ("worker idles near-zero CPU; parse spikes are short and infrequent; expected avg << 0.25 vCPU / 0.5GB") and note the realistic ceiling (a continuously-busy or memory-heavy worker can reach ~$20-30/mo). Set a billing alert since Railway has no hard cap. This does not change the architecture — it sizes the operating cost honestly.
- Sources:
  - https://docs.railway.com/pricing/plans ($5 Hobby + $5 credit; $20/vCPU, $10/GB)
  - https://docs.railway.com/pricing/understanding-your-bill (per-second metered usage)
  - https://railway.com/pricing
  - Corroborating analyses of idle/24-7 cost: https://www.srvrlss.io/provider/railway/ , https://expresstech.io/7-railway-alternatives-in-2026-flat-pricing-vs-usage-bills/

### 10. HMAC-SHA256 byte-identity across Go `crypto/hmac`+`crypto/sha256` and browser `SubtleCrypto` — **PASS**
- Both implement standard HMAC-SHA256 (RFC 2104 over SHA-256). Given identical **raw key bytes** and identical **message bytes**, the two produce byte-identical MAC output. SubtleCrypto's `importKey('raw', …, {name:'HMAC', hash:'SHA-256'})` + `sign('HMAC', …)` returns the same 32-byte tag Go's `hmac.New(sha256.New, key)` produces. This is the foundation the spine's cross-language golden-vector suite (`roulette/vectors/`) gates on, and it is sound.
- The spine's care is what makes byte-identity *reachable*: raw 32-byte seed as the key (not the hex string), explicit `LE64(i)` counter framing, per-decision domain-separation labels, and integer-only arithmetic. These remove the usual divergence sources (string encoding, float formatting, locale). AD-14's design is correctly specified.
- Sources:
  - https://pkg.go.dev/crypto/hmac
  - https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign
  - https://github.com/danharper/hmac-examples (cross-language byte-identical HMAC-SHA256 examples)

### 11. RFC 8785 (JCS) canonical JSON — **PASS** (real spec; spine's integer-string mitigation is correct, not a flaw)
- RFC 8785, "JSON Canonicalization Scheme (JCS)," is a real published RFC (Informational, June 2020). It defines deterministic property sorting (UTF-16 code-unit order), fixed string escaping, whitespace removal, and number serialization via ECMAScript `Number.prototype.toString` (IEEE 754 round-trip). Multiple open-source implementations exist in Go and JS.
- IMPORTANT nuance the spine handled correctly: JCS numbers are IEEE 754 doubles, so integers beyond 2^53 do **not** round-trip safely as JSON numbers. The spine pre-empts exactly this by serializing large ids (SteamID64) as **decimal strings** and keeping fairness math integer-only. That is the right mitigation for JCS, not a contradiction of it. The "ASCII-restricted" qualifier is a reasonable extra constraint (avoids any UTF-16-vs-codepoint sorting edge cases). Capability claim is accurate and the design is sound.
- Sources:
  - https://datatracker.ietf.org/doc/html/rfc8785
  - https://www.rfc-editor.org/info/rfc8785/

### 12. MatchZy (CS2 server plugin) — **PASS (named tech exists and fits; not deeply re-versioned)**
- MatchZy is a real, actively-used CS2 matchmaking/server plugin that produces demo recordings and POST-able match data — consistent with the spine's "MatchZy → worker HTTP (shared-secret) → R2" ingest path. The spine sensibly **defers** the MatchZy-match-id-vs-pre-registration association to build-time (listed under Deferred), so no version is bound here. No currency risk: the demo `.dem` format consumed by the worker is the CS2/Source-2 format, which demoinfocs v5.2.0 parses (item 4). Treated as a low-risk integration detail rather than a version-bound dependency.

---

## Summary of findings (severity-ranked)

| # | Severity | Item | Finding | Fix |
|---|----------|------|---------|-----|
| 9 | **Medium** | Railway Hobby cost | "~$5-10/mo always-on" is optimistic; Railway bills actual CPU/RAM with no scale-to-zero in prod and no hard cap — a busy/memory-heavy worker can hit ~$20-30/mo. Stated without a utilization assumption. | State the low-utilization assumption explicitly in the handoff doc; note ~$20-30 ceiling; set a billing alert. |
| 5 | **Low** | Supabase-Storage fallback | The `DemoStore` Supabase fallback can't hold typical 50-170MB demos on the free tier (50MB/file cap). | Note in build doc that the Supabase impl is small-demo / paid-tier only; R2 is the real path. |
| 11 | **Low** (informational) | RFC 8785 numbers | JCS serializes numbers as IEEE 754 doubles (>2^53 unsafe). | Already mitigated (SteamID64-as-string, integer-only) — keep that invariant and the cross-language vectors will hold. |

Everything else (Next.js 16.2.x / Node 20.9+, Go 1.26.x, demoinfocs-golang v5.2.0 active+CS2+per-tick, Supabase free-tier limits & Broadcast choice, Vercel 4.5MB cap, Cloudflare R2 capabilities, HMAC-SHA256 byte-identity) **PASS** — current as of mid-2026, correctly capability-matched, no deprecations or renames. No technology in the Stack table appears asserted-without-verification; the version pins are all live and the capability claims are accurate.
