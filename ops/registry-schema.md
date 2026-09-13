# The registry-schema gate

The written record of `contracts/registry.schema.json`, `ops/registry-schema.mjs` and the
`registry-schema` job in `.github/workflows/ci.yml`: why the gate exists, what it checks and what it
deliberately does not, the job's properties and how far its blocking reach actually goes, the
dialect and `format` decisions, the value sets with the requirement each answers, the four rules
applied beyond the schema, the demonstration with its output verbatim, which standing cases hold the
failure paths permanently, the stated limits, and the work this file hands the Operator.

Written during Story 2-3 on **2026-08-29** (ISO 8601 UTC), against baseline commit `3251f2b`.
**Amended during Story 2-5 on 2026-09-03**, at baseline commit `d21f0c7`, when the fourteen entries
were authored: `minItems: 1` was set, two structural rules were added, and the demonstration was
re-run. **Amended again during Story 2-6 on 2026-09-03**, at baseline commit `4b71ae2`, when the
fourteen descriptions were confirmed against their sources: a fourth rule was added for the
mechanizable half of FR-8, and the demonstration was re-run a third time. Every statement either
amendment supersedes is struck or labelled rather than deleted.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/contract-purity.md`, `ops/token-contract.md` and `ops/font-contract.md`
set: every value is marked **Observed** with its method or **Decision** with its reason (NFR-9), and
every date is ISO 8601 UTC.

## Why the gate exists at all

AD-4 makes `contracts/registry.json` the estate's only App Registry: authored by hand, carrying
`$schema` so an editor validates while the entries are written, with `contracts/registry.schema.json`
fixing the shape and CI failing the build on a malformed entry. AD-21 lists "Registry schema
validation" among the gates that may never become warnings. FR-6 says validation of the entry
contract fails the build.

**None of it existed before this story.** **Observed 2026-08-29** at `3251f2b`: neither
`contracts/registry.json` nor `contracts/registry.schema.json` was in the tree, and
`.github/workflows/ci.yml` carried five jobs, none of them a Registry check. The shape had to be
fixed and mechanically enforced **before** the entries are written, not after: Story 2.5 authors one
entry per Estate application and Story 2.7 has the Hub import the result, and a malformed entry that
ships is inherited by every consumer in every estate language.

## What the gate checks, and what it deliberately does not

| It checks | It does not check | Nature |
|---|---|---|
| Every entry against AD-5's shape: the eight required fields, the four optional ones, the three closed value sets, the kebab-case and `https://` patterns, and both halves of the `live` condition | Whether a `live` or `source` URL resolves | **Decision.** FR-32 gives link verification to a scheduled job, which is Story 2.23. A gate on a runner asserting a URL resolves would fail on a network blip |
| Four named rules **beyond** the schema: no two entries share an `id`, every `absorbed_into` names an entry that is not itself, no `family` value is carried alone, and every `description` keeps the mechanizable half of FR-8's editorial contract while every `name` and `description` is typeset | Whether an id matches a repository that exists, and whether a `family` value names anything | **Decision.** AD-3 derives every other identifier from the id; a repository sweep is a different check with a different failure mode. A family key is a label rather than a reference, so it is not held to naming an entry |
| Of FR-8: one to three sentences, the six banned adjectives as whole words, ten first-person words at a word boundary, and the three untypeset punctuation forms in `name` and `description` | Whether a description **leads with the thing itself**, whether a status synonym has crept into prose, whether a number was invented, and **whether a sentence is carried by two entries** | **Decision**, 2026-09-03. The first three need judgement and each would refuse honest prose. FR-8's fourth clause is the clearest case: "leads with the thing itself" is satisfied by "Turns any list into a wheel" and by "A self-hosted library for ebooks and comics", and no pattern separates either from the framing FR-8 actually bans. The fourth is mechanical and is deliberately not here: see the stated limit below |
| That the list is not empty, since Story 2.5 authored entries and set `minItems: 1` | Whether the entry count matches `ops/registry-inputs.md` | **Decision**, deferred by the Operator on 2026-09-03. Stated limit below |
| That every keyword in the schema is one this validator implements, before the Registry is read at all | Any dialect feature outside the implemented set | **Decision.** A validator that silently ignores a keyword is green over the rule it never applied. The set is listed below |
| That both files exist, parse, and were actually read | The served copy at `https://cuatro.dev/contracts/registry.json` | **Decision.** The gate reads the committed tree on a runner. Stated limit below |
| Nothing about the entries' truth: a `description` that lies, a `tech` array naming a framework the application does not use, or a `status` that is out of date all pass | | **Decision.** The schema is a shape, not an audit. FR-32's scheduled job and the Operator are what keep the values honest |

## The job

`.github/workflows/ci.yml` gained one job, `registry-schema`, placed after `contract-purity`. The
`test`, `tokens-contract`, `fonts-contract`, `contract-purity` and `rendered-output` jobs were not
modified.

| Property | Value | Nature |
|---|---|---|
| Blocking | Yes. The job carries no `continue-on-error`, no `\|\| true`, no `if:`, no `needs:` and no soft exit, so a malformed Registry is a red job on every push and every pull request | **Decision.** AD-21, which names Registry schema validation in its list of gates that may never become warnings, and `AGENTS.md` under "Policy" |
| **How far that reach goes** | A red job stops **nothing mechanically today**. GitHub holds a merge only on a **required status check**, and `.github/workflows/deploy.yml` fires on the same push to `main` with no `needs:` and no `workflow_run:`, so a red Registry job does not hold a deploy either | **Observed 2026-08-29** for the deploy half, by reading both workflow files. The required-check half is a repository setting no command on this host can read. The same is true of all six jobs; `ops/contract-purity.md`'s Operator action 2 already asks for it and this story adds a sixth job to that sitting. Pending Operator action 2 |
| Triggers | `push` to `**` and `pull_request` to `main` | **Observed 2026-08-29.** The job sits in the existing file and inherits that file's `on:` block at `:3-7` rather than declaring its own, so the two can never drift. A standing case asserts the job declares no `on:` of its own |
| Position | After `contract-purity`, before `rendered-output` | **Decision.** Jobs run in parallel, so the position is a reader convenience. Two standing cases now pin the six job names as a set that happens to be ordered, one in this story's suite and the pre-existing one in `ops/__tests__/contract-purity.test.ts` |
| Runner | `ubuntu-latest`, Node 22 through `setup-node` | **Decision.** The Node major every other job in the file pins |
| Installs | Nothing. No `pnpm/action-setup`, no `pnpm install`, no pnpm cache | **Decision.** The validator imports only `node:` builtins and adds no dependency, `ajv` included, so the Registry is still validated on the run where `pnpm install --frozen-lockfile` fails. Same argument as `contract-purity`, whose job block this one copies |
| Ceiling | `timeout-minutes: 5` | **Decision.** Checkout, `setup-node`, two file reads and a walk of one envelope. The same ceiling as `contract-purity`, and pinned by a standing case, because a figure this file states and nothing asserts is a figure that drifts |
| Command | `node ops/registry-schema.mjs`, with no argument and no `env:` | **Decision.** See "Nothing redirects it" below. A standing case pins the whole command line and asserts the job carries exactly one `run:` step, a second pins the two action steps beside it, and a third holds the absence of a workflow-wide `env:` |
| Lines added to `ci.yml` | 34 added, **0 removed** | **Observed 2026-08-29** by `git diff --numstat 3251f2b -- .github/workflows/ci.yml` |
| The five existing jobs | Byte-identical to `3251f2b` | **Observed 2026-08-29**, by comparing the first 178 lines of the file case-sensitively against the same lines of `git show 3251f2b:.github/workflows/ci.yml`, which is everything through the `contract-purity` job's `run:` line, and the tail from `rendered-output:` onward against the baseline's tail. Corroborated by the 0 removed lines above |

## Nothing redirects it

No environment variable and no argument selects which files the validator opens. Both paths are
fixed in the source and resolved beside the module, so the gate works from any working directory and
no caller can point it at a file that happens to be valid.

That is not a stylistic choice, and `ops/contract-purity.md` records why at length: `ci.yml:53-64`
and `:113-124` had to pin two build inputs empty on each of the two contract jobs precisely to close
that hole for the drift gate. A redirectable Registry gate has the same shape of hole, because a
check that validates a file nobody published is green over anything.

Four standing cases hold it: one spawns the gate with a scratch directory carrying an invalid
Registry as its argument and requires exit 0 anyway, one asserts the module's own source contains no
`process.env`, no `node:process` import and no `process.argv` position other than `[1]`, one asserts
the job's `run:` line is the whole command with nothing appended, and one asserts the module reaches
for no dependency by a static import, a dynamic `import()`, `createRequire` or a bare `require()`.

**A refusal records its verdict before it writes.** **Decision**, inherited whole from
`ops/contract-purity.mjs`: `process.exit` runs inside the write callback so a pipe cannot truncate
the refusal, and `process.exitCode` carries the verdict so a stream torn down before that callback
fires cannot leave the process falling off the end of the module and exiting 0. Held by a case
reading the module's source, for the reason that record gives.

**The invoked-directly guard never answers "no" when it cannot tell**, for the same reason and with
the same `realpathSync` fallback, held by its own case.

## What is escaped, and what is not

**Everything that reaches a refusal from outside this module is escaped**, on the reasoning
`ops/contract-purity.md` sets out under "Characters that forge or disguise a line": a value carrying
a newline forges a line that reads like this gate's own prose and can push the real violation out of
an operator's view, and a bidirectional override or a zero-width character lets two different values
be drawn identically in a log.

Three things reach a refusal from outside: a **Registry value**, quoted through `show()`; a
**pointer**, built from Registry and schema property names; and a **parser or filesystem message**.
The story's review pass found the second and third of those printed raw, so a schema carrying a
property name with a newline forged a line the first was protected against. All three now go through
the escaping. **A violation's detail is deliberately not escaped as a whole**, because it is this
module's own prose assembled around already-escaped parts, and a blanket escape would print a quoted
`pattern` with a doubled backslash: the one string an operator is being sent to the schema to
compare. That is the same line `ops/contract-purity.md` draws under "Only the untrusted half of a
reason is escaped", and both halves have a case.

**The two escapers share one predicate.** `printable()` and the `escapeInvisible()` that `show()`
uses differ only in what they do to a backslash: `JSON.stringify` has already escaped the backslash
and the C0 range by the time `show()` runs, so doubling them there would print every authored newline
as `\\n`, which is noise rather than safety. They disagreed about exactly one character before the
review pass, U+007F, which `JSON.stringify` does not escape either, so a DEL in an id reached the log
as itself. One shared `HIDES` predicate now decides which code points are dangerous, and a standing
case runs ten of them, DEL and a C0 control included.

**The quoting is injective up to truncation, and not past it.** A value longer than 120 code points
is cut, so two values agreeing on their first 120 print identically. That is a deliberate trade: a
hand-authored `id` or URL that long is already the defect. The cut is by **code point** rather than
by UTF-16 code unit, because a cut by code unit can land between the halves of an astral character
and emit a lone surrogate, which is a code point neither escaper describes and no terminal draws.
Both properties have a case.

## The dialect, and why `format` appears nowhere

**Draft-07, not 2020-12.** **Decision.** The gate and the editor have to agree, and draft-07 is the
dialect every editor and every language's validator implements fully. `definitions` rather than
`$defs` follows from it. A Satellite in Elixir, Go or Python that wants to validate the Registry it
fetched can reach for a draft-07 validator in its own language and get the same answers.

**No `format` keyword anywhere.** **Decision.** `format` is annotation-only in some validators and
an assertion in others, so the editor and the gate would disagree about what the schema asserts.
`source` and `live` are constrained by `pattern: "^https://"` instead, which every validator applies
identically. A standing case asserts the string `"format"` appears nowhere in the schema, and the
validator refuses the keyword by name with that reason in the refusal.

**The validator implements a fixed keyword set, and anything outside it is a refusal.** **Decision.**
The set, exported as `KEYWORDS` and pinned by a standing case:

```
$id, $ref, $schema, additionalProperties, allOf, const, definitions, description, else,
enum, enumDescriptions, if, items, minItems, minLength, not, pattern, properties, required,
then, title, type, uniqueItems
```

Six of those assert nothing and are implemented by knowing that: `$id`, `$schema`, `title`,
`description`, `definitions` as a container, and `enumDescriptions`. The audit runs **before the
Registry is parsed**, so a schema carrying an unimplemented keyword can never produce a verdict about
an instance, and a standing case plants a keyword and a violation together and requires the keyword
to be what is reported.

Three smaller refusals follow from the same argument and are noted rather than tabled. A `$ref`
carrying siblings is refused, because draft-07 discards every sibling of `$ref` and the schema would
read as though those rules bound while nothing applied them. A subschema that is not an object,
which includes draft-07's legal boolean schemas, is refused because this validator applies no rule
to one. And **an `if` carrying neither `then` nor `else` is refused**, because the condition is
evaluated and its answer discarded: the schema reads as though it still carried a rule while
asserting nothing. That last one is the keyword audit's own argument one level down, and it guards
exactly the two members that carry the `live` condition, where deleting a `then` in an edit would
otherwise leave both halves looking intact.

**A leading byte order mark is stripped before either file is parsed.** **Decision.** `JSON.parse`
throws on a U+FEFF, so a valid Registry saved by an editor on the Windows host these files are
authored on would read as malformed with a message about position 0 that says nothing about a
character its author cannot see. Only a leading one is stripped; a U+FEFF anywhere else is inside a
string value, where it is escaped when quoted. Both halves have a case.

**`enumDescriptions` is VS Code's own annotation**, and it is here because draft-07 has no other way
to say what an enum value means. The idiom would be `oneOf` with one `const` and one `description`
per value, and `oneOf` is deliberately outside the implemented set: it is the keyword the story's
matrix names as the refusal case, and implementing a branch combinator would mean this gate deciding
which branch's message to print. `enumDescriptions` asserts nothing in either reader. The audit holds
it to one description per enum member, so "every enum value carries a description" is mechanically
true rather than a claim about the author's care.

## The value sets, and the requirement each answers

| Field | Values | Requirement | Nature |
|---|---|---|---|
| `status` | `Live`, `Complete`, `In progress`, `Archived` | AD-5 fixes exactly these four. FR-35 renders the first two and holds the other two | **Decision**, transcribed from AD-5 |
| `identity` | `oidc`, `wallet`, `none` | AD-12: every entry carries one, absence is not a permitted value. `MaiCoin` is `wallet` and structurally exempt, not unimplemented | **Decision**, transcribed from AD-12 |
| `demo` | `demo-account`, `open`, `not-deployed`, `none` | FR-27 names three categories: usable with a Demo Account, usable without authentication, not deployed. `none` is the fourth, deployed with no demo access offered, which C-10 and FR-27's `MaiCoin` bullet both need | **Decision.** The one value set this story adds to rather than transcribes, and it is recorded as such |
| `live`, `source` | `^https://[^\s/]+(/\S*)?$` | AD-3: **no hostname is derived from an id**. Three live hostnames already diverge from their ids, so the Registry is the only mapping and the host is free. What the pattern does fix is that there **is** a host and that the value carries no whitespace | **Decision**, from AD-3. The pattern was `^https://` until the story's review pass, which is an anchor and nothing else: it accepted the bare scheme `"https://"`, `"https:// "`, and a value with an embedded space or newline. `source` is FR-6's drill-through to the code and `live` is what FR-28 says must resolve, so a hostless value passing the gate is the Registry lying in the one field a reader clicks. Nine values, four accepted and five refused, have standing cases |
| `contract_version`, `token_contract` | `^\d+\.\d+\.\d+$` | AD-5's envelope version and AD-16's adopted token contract version | **Decision.** `contract_version` moved to **`1.1.0`** on 2026-09-03, by Operator ruling, when Story 2.5 authored the fourteen entries. The field's own rule is "a value change is a minor bump; any field rename is major (AD-16)", and going from zero entries to fourteen while narrowing `applications` with `minItems` is a value change by that wording. AD-4 has Satellites fetch this file over HTTPS at build time, so the version is the only signal one of them has that the Registry stopped being an empty envelope. The two version fields are unrelated: `token_contract` on `cs-tracker` is the **token** contract's `1.0.0` and did not move |

**`demo` is a closed set of four rather than an object with a mode and a URL.** **Decision.** An
object was the alternative and is deferred: Story 2.4 records Mutuo's pre-existing demo accounts, and
FR-25 is where a richer shape would earn itself. Widening `demo` later is a Registry minor bump, and
narrowing it is not, which is the asymmetry that makes starting closed the cheap direction.

## The four rules beyond the schema

**It was one rule until 2026-09-03, then three, and is now four.** Story 2.5 added the second and the
third in the change that first authored entries, because both are about `absorbed_into` and `family`,
and until that day no entry carried either field for a rule to be wrong about. Story 2.6 added the
fourth on the same date, when the fourteen descriptions were confirmed against their sources: FR-8
lived only as prose in the `description` node's annotation, which asserts nothing in either reader,
so the contract every `description` is written to was held by nobody. **That annotation is unchanged
and still asserts nothing**, which is what an annotation does; what moved is that the mechanizable
half of what it says is now applied by the gate.

The first three are each a statement about the entries **as a set** rather than about one value,
which is exactly what draft-07 has no keyword for. The fourth is a rule that has to **name the word
it found**, which a schema refusal cannot do. Each is applied by `ops/registry-schema.mjs`, named in
its own refusal, and exported by name with a standing case, so a rule cannot quietly stop firing.

| Rule | What it refuses | Why the schema cannot |
|---|---|---|
| `unique id` | Two entries carrying one `id` | Draft-07 cannot compare two entries. AD-3 makes the id the name every other identifier is derived from, so two entries sharing one is two applications claiming the same GHCR image, compose service, Traefik router and Postgres database |
| `absorbed_into resolves` | A value naming no entry in the file, and an entry naming itself | Draft-07 cannot express a reference at all. AD-6 keeps an absorbed application's entry so a reader can follow the field to where the code went; a dangling value breaks the one guarantee the field makes, and a self-reference resolves while saying the code moved to where it already was |
| `family groups` | A `family` value carried by exactly one entry | Draft-07 can neither count the entries carrying a value nor compare them. FR-11 makes `family` a grouping, and a value appearing once is the one thing it cannot mean: either the second member was dropped or one of the two spellings is wrong |
| `editorial voice` | A `description` outside one to three sentences, or carrying one of the six banned adjectives **as a whole word** in any case, or one of ten first-person words at a word boundary; and a `name` or a `description` carrying a straight double quote, a double hyphen or three periods | `not` with a `pattern` is implemented and would bind, but the validator compiles patterns with no flags, so a case-insensitive list needs character classes, and `not`'s refusal says only "this value matches a shape the schema forbids here". **An editorial gate that cannot name the word it found teaches nothing**, and teaching the author at the moment of refusal is the whole of what this rule is for |

**The editor catches none of them**, which is a stated limit rather than an oversight: AD-4's
authoring half is the editor validating while the entries are written, and these four are what that
half does not cover. `BEYOND_THE_SCHEMA` is the one sentence all four refusals carry, worded once and
pinned by a case, and it says so to whoever reads the log. It was reworded on 2026-09-03 because its
old text argued from uniqueness and reference, which is true of the first three rules and of none of
the fourth.

**Why the sentence counter is honest against this field and would not be in general.** Counting
terminators is a naive way to count sentences: an abbreviation or a version number breaks it. It is
safe here precisely because FR-8 bans the thing that would break it. "The stack is the `tech` field's
job", so `Next.js` and `v1.2` cannot appear in a `description` without already being a defect a
person has to catch. **That dependency is the reason the rule can be trusted and the reason it must
never be lifted onto another field**: `tech` carries `Next.js` and `ethers.js` today, and the same
counter over that array would be wrong on its first run.

**A sentence ends at a terminator plus any run of closing punctuation, and that is not a nicety.**
**Corrected 2026-09-03 at the review, after the first implementation shipped without it.** The
counter's first form was a bare `[.!?]` before whitespace or the end of the string, which counted a
description ending in a typeset ellipsis, or in a full stop inside a closing curly quote, as **zero**
sentences and refused it citing "never four". The punctuation half of the same rule refuses three
periods and a straight quote and therefore **requires the author to write exactly those two shapes**.
The rule was refusing what it mandated. U+2026 is now a terminator for the same reason it is the
mandated replacement for three periods, and U+201D, U+2019, `)`, `]` and `}` close a sentence without
ending it. **The general form of the lesson: the two halves of one rule may never contradict each
other on a shape the rule itself forces.** Five positive controls hold it, one per shape, beside a
four-sentence fixture ending the same way so the allowance cannot swallow the count.

**The punctuation half reads `name` and `description`; the rest reads `description`.** **Narrowed
2026-09-03 at the review, by Operator ruling, from every string in the Registry.** `epics.md:2271`
sets UX-DR38's typeset rule over "every string in the Registry", and read literally that reaches
`source`, `live`, `id`, `family` and `absorbed_into`. **For a URL it is an unfixable refusal**: a
repository whose name carries a double hyphen would have been refused and told to write an em dash,
which is a repair that 404s the entry, and which the story separately forbids. Nothing in the shipped
Registry trips it, which is what made it a trap rather than a bug. UX-DR38 governs what a Visitor
reads, so the rule reads the two fields a Visitor reads. **The `id` and `family` patterns already
refuse a double hyphen on their own**, being kebab-case, so the narrowing gives up nothing there; the
exposure was `source` and `live`, whose pattern permits one.

**The two punctuation rules in this estate govern different things and do not conflict**: a string a
Visitor reads is a product string and takes a curly quote, an em dash and an ellipsis, while prose
written **into** this repository, this record included, takes no dash at all (`AGENTS.md:23-25`).
`DESIGN.md:491-497` states the reconciliation. The gate's own source names the three typeset
replacements **by code point rather than by character**, the same idiom it already uses for the byte
order mark, which is what lets one file carry a rule about a character it may not itself contain.

**The straight single quote is deliberately not among the three forms.** **Decision**, 2026-09-03.
`DESIGN.md:491` says "curly quotes", which in ordinary typesetting covers the apostrophe, and an
apostrophe inside a word is by far the commonest case. It is out because the story's matrix names
three forms and only three, and widening a refusal past the row that authorises it is how a gate
starts refusing things nobody agreed to. Nothing costs anything today: **no shipped `name` or
`description` carries an apostrophe at all**, straight or curly. The cheap moment to add it is the
first entry that wants one, in the same change that decides whether `it's` is written with U+2019.

**The banned adjectives match as whole words and the refusal names the text it matched.**
**Corrected 2026-09-03 at the review, by Operator ruling.** The substring form shipped first and was
wrong in both directions: it refused `"modernization"` and `"trailblazing"`, which are honest prose,
and it named the list entry it matched against rather than the author's own word, so a refusal citing
"blazing" sent its author looking for a word not in their description. That contradicts the reason
the rule sits outside the schema at all. **`"blazingly"` now passes and that is the recorded cost**:
FR-8 bans six words by name, and a rule that refuses honest prose is switched off by the next author
rather than read.

**First person is ten words, not four.** **Corrected 2026-09-03 at the review.** The story's matrix
row listed `I`, `we`, `our` and `my` as examples and they shipped as the definition, so
`"It shows us the file and gives me mine."` passed a rule advertised as banning first person. The set
is `i`, `we`, `us`, `our`, `ours`, `my`, `mine`, `me`, `myself`, `ourselves`, matched at word
boundaries and never as substrings: "Wednesday" must not read as "we", "four" as "our", "because" as
"us" and "some" as "me". A standing case runs all four collisions through in one description.

**What the rule deliberately does not assert.** FR-8's fourth clause, "leads with the thing itself",
is not mechanized: it is satisfied by "Turns any list into a wheel" and by "A self-hosted library for
ebooks and comics", and no pattern separates either from the framing FR-8 bans. Neither is UX-DR38's
status-synonym rule, which needs a word list that would refuse an entry legitimately using the word
"live", nor its "never invent a metric" rule, which cannot tell a supplied number from an invented
one. Each of the three would refuse honest prose, and a gate that does that is a gate the next author
switches off rather than reads.

**And it does not hold that no sentence appears on two entries, which was the story's headline
defect.** Five of the fourteen descriptions ended with "It is in early development and nothing is
deployed yet" before Story 2.6, and the repetition is what the pass was largely for. It is a
statement about the entries **as a set**, exactly the shape of the first three rules, and it could be
a fifth one. It is not, because the story's matrix authorises four and a rule the matrix does not
name is a refusal nobody agreed to. **What holds it instead is one case in
`ops/__tests__/registry-schema.test.ts`**, which splits every shipped description on the same
exported `SENTENCE_END` the gate counts with, and fails if any sentence appears twice. See the stated
limit below for what that costs: the check exists in this repository and nowhere else.

**The green line is built from the rule list, not from a literal.** **Corrected 2026-09-03 at the
review.** `RULES_BEYOND_THE_SCHEMA` pairs each rule's function with the clause it contributes,
`inspect()` runs that array and reports the clauses of the rules it actually ran, and `report()`
joins them. Before that the clauses were a literal inside `report()`, so the line named four rules
whether or not four ran: unwiring a rule left its clause printing and the case asserting that clause
stayed green, which defeats the whole argument for enumerating rather than counting. Two cases now
hold it in both directions, one pinning the list as a literal so a fifth rule is deliberate, one
requiring every clause in the list to reach the line.

**A note on the second rule's scope.** It reads `absorbed_into` only. `family` is deliberately **not**
required to name an entry, because a family key is a grouping label rather than a reference to an
application, and nothing in FR-11 says a family is named after one of its members. `tracker-family` is
carried by three entries and is the id of none of them.

**And it checks one hop, not a graph.** `absorbed_into` is verified to name an entry that exists and
is not the entry itself, and nothing further. **A chain passes** (`a` absorbed into `b` while `b` is
absorbed into `c`) and **a two-entry cycle passes** (`a` into `b`, `b` into `a`), because neither is a
self-reference and both names resolve. Both shipped carriers point at entries that are not themselves
absorbed, so nothing in the Registry exercises it today. Left as a **Decision** rather than closed:
cycle detection is a different rule with a different refusal, DW-27 asked for reference integrity
rather than for a graph walk, and a consumer following the field one hop, which is what AD-6 describes
a reader doing, cannot loop. **The exposure is a consumer that follows it transitively**, and there is
none.

## The demonstration

A gate never observed to fail is not known to work. A deliberately malformed `contracts/registry.json`
was planted, the gate run, its output recorded here, and the file restored. **No fixture exists in
the tree at this story's closing commit**, which is why its output lives in this file.

| Field | Value | Nature |
|---|---|---|
| The fixture | Three entries breaking **six** rules between them: a `Live` entry with no `live`; an entry carrying `"status": "Retired"` and a `"licence"` field and no `demo`, which is three; and an `Archived` entry carrying a `live` URL and repeating the first entry's id, which is two | **Decision.** One entry per class of refusal the matrix names, in one file, because "every violation in a run" is the claim being demonstrated. The count is six and the output below lists six |
| Result | The job's command exited **1** and wrote the refusal to stderr, naming all six violations by JSON Pointer, in sorted order, each with the rule that rejected it | **Observed 2026-08-29** on the Windows 11 development host, by running `node ops/registry-schema.mjs` against the working tree |
| Removed | Yes | **Observed**, confirmed by the gate exiting 0 again against the committed envelope |

The command's output, quoted verbatim:

```
registry schema: REFUSED
  AD-4: contracts/registry.json is the estate's only App Registry, and
  contracts/registry.schema.json fixes its shape, so CI validates it and a malformed
  entry cannot ship. AD-21 makes this gate blocking rather than a warning: there is one
  environment and no staging, and the Registry is read by every consumer in every estate
  language, so nothing downstream catches what it lets through.
  6 violations in contracts/registry.json, by JSON Pointer:
    /applications/0: "live" is required here and is absent
      rule: required, at #/definitions/application/allOf/0/then/required
      FR-6 and AD-5, first half: "live" is required when "status" is Live. An entry the Suite Directory renders as running has to say where it runs.
    /applications/1: "demo" is required here and is absent
      rule: required, at #/definitions/application/required
      What a Visitor can do with this application before they click (FR-27). Required with an explicit value: absence is never a permitted way to say "not applicable" (AD-5).
    /applications/1/licence: "licence" is not a field this schema defines, and additionalProperties is false here. The fields it defines are "id", "name", "description", "status", "tech", "source", "demo", "identity", "live", "family", "absorbed_into", "token_contract"
      rule: additionalProperties, at #/definitions/application/additionalProperties
      One Registry entry (AD-5): eight required fields, four optional ones, and nothing else. additionalProperties is false, so a field a consumer cannot rely on never reaches one.
    /applications/1/status: "Retired" is not one of the 4 permitted values: "Live", "Complete", "In progress", "Archived"
      rule: enum, at #/definitions/application/properties/status/enum
      The application's lifecycle state (FR-7). Exactly one of four strings; the Suite Directory renders Live and Complete and holds the other two (FR-35).
    /applications/2: this value matches a shape the schema forbids here
      rule: not, at #/definitions/application/allOf/1/then/not
      FR-6 and FR-28, second half: "live" is forbidden when "status" is Archived. An application taken offline loses its URL in the same change, so no entry ever presents a "live" URL that does not resolve.
    /applications/2/id: the id "cs-tracker" is already carried by /applications/0 (AD-3: one id per application)
      rule: unique id
      Uniqueness across entries cannot be expressed in draft-07, so this is the one rule this gate applies beyond the schema, and the editor will not catch it.
  Fix the entries, or renegotiate the shape in contracts/registry.schema.json and in
  AD-5. A malformed entry that ships is inherited by every consumer in every estate language.
```

And the same command against the committed envelope, which is the other half of what makes the
refusal meaningful:

```
registry schema: read contracts/registry.json against contracts/registry.schema.json, 0 applications, valid, no duplicate id (AD-4, AD-5).
```

**Both quotations above are history from 2026-08-29 and are kept rather than corrected.** Story 2.5
reworded `BEYOND_THE_SCHEMA` for three rules and widened the pass line, and Story 2.6 reworded it
again for four and widened the line again, so neither string is what the gate prints today. **The
`BEYOND_THE_SCHEMA` line quoted in the 2026-09-03 fixture A output below is history for the same
reason**: it argued from uniqueness and reference, which is true of the first three rules and of none
of the fourth, and the sentence the gate prints today is quoted under fixture C. The last run in this
file is the current one. This file does not delete what it supersedes, which is the same idiom
`ops/estate.md` and `ops/known-violations.md` follow.

## The demonstration, re-run 2026-09-03 for the two new rules

Story 2.5 added `minItems: 1`, `absorbed_into resolves` and `family groups`, and a rule never observed
to fail is not known to work. Two fixtures were planted in `contracts/registry.json`, the gate run
against each, the output recorded here, and the file restored. **Restoration was verified by SHA-256
rather than by eye.** The digest is written out in full below rather than elided, because an elided
one cannot be re-checked and re-checking is the entire point of recording it. **No fixture is in the
tree at this story's closing commit**, and the gate exits 0 against the restored file.

```
SHA-256 of contracts/registry.json, before and after the fixtures, at this story's final tree:
BFB28AF7BAA039F17C10D01287403B1BFC40EF3EBB4B63ABBB5BDBE05706D7A9
```

**The demonstration was run three times, and only the last digest is recorded**, because the first
two were taken against a `contracts/registry.json` the review pass then changed: once to correct the
`connect-four-react` description, once to move `contract_version` to `1.1.0`. A digest that does not
match the committed file is worse than no digest, since a reader who checks it and finds a mismatch
learns nothing about whether a fixture was left behind. The refusal outputs below are from the runs
that produced them and are unchanged by either edit, neither of which touches a rule.

| Field | Value | Nature |
|---|---|---|
| Fixture A | Three entries, one per new structural rule: `absorbed_into: "ghost-app"` naming nothing, `absorbed_into: "beta"` on the entry whose id is `beta`, and `family: "tracker-family"` carried by one entry alone | **Decision.** One entry per rule, so a refusal that names two proves the third is the one that did not fire |
| Fixture B | The envelope restored to `applications: []`, which is exactly the state Story 2-3 shipped and this story makes a refusal | **Decision.** The inversion is the whole point of DW-26, so it is demonstrated as its own run |
| Result | Fixture A exited **1** with three violations, one per rule; fixture B exited **1** with one | **Observed 2026-09-03** on the Windows 11 development host |
| Removed | Yes, byte for byte | **Observed 2026-09-03** by SHA-256 comparison against the pre-fixture copy |

Fixture A, quoted verbatim from the AD-4 header down:

```
  3 violations in contracts/registry.json, by JSON Pointer:
    /applications/0/absorbed_into: no entry in this Registry carries the id "ghost-app" (AD-6: an absorbed application keeps its entry and names where its code now lives)
      rule: absorbed_into resolves
      Uniqueness and reference across entries cannot be expressed in draft-07, so this is one of the three rules this gate applies beyond the schema, and the editor will not catch it.
    /applications/1/absorbed_into: the id "beta" is this entry's own (AD-6: absorbed_into names where the code now lives, which is never the entry itself)
      rule: absorbed_into resolves
      Uniqueness and reference across entries cannot be expressed in draft-07, so this is one of the three rules this gate applies beyond the schema, and the editor will not catch it.
    /applications/2/family: "tracker-family" is carried by this entry alone (FR-11: a family groups, so either a second entry shares the value or the field does not belong on this one)
      rule: family groups
      Uniqueness and reference across entries cannot be expressed in draft-07, so this is one of the three rules this gate applies beyond the schema, and the editor will not catch it.
```

Fixture B, which is the tightening DW-26 asked for. **Three lines, not two**: every violation carries
the `description` of the schema node that rejected it, and a `minItems` violation is no exception, so
the constraint explains itself to whoever hits it:

```
  1 violation in contracts/registry.json, by JSON Pointer:
    /applications: 0 item(s), where at least 1 is required
      rule: minItems, at #/properties/applications/minItems
      One entry per application, never per repository (AD-6): an archived or absorbed application keeps its entry, so the entry count and the repository count are different numbers by design. minItems is 1 from Story 2.5, the story that first wrote entries here. Until then the envelope carried zero and the constraint would have failed its own gate; after it, an edit that empties the array would otherwise validate and the Hub would render an empty Suite Directory from a green build.
```

And the committed pair as it stood at the end of Story 2-5:

```
registry schema: read contracts/registry.json against contracts/registry.schema.json, 14 applications, valid, no duplicate id, every reference resolves, every family groups (AD-4, AD-5).
```

**The pass line gained two clauses and that is deliberate.** It said "no duplicate id" while the gate
applied one rule beyond the schema. It now applies three and names all three, because a green line
claiming less than the run actually checked is the same defect in the other direction as a gate that
is green over a rule it never applied. **The line enumerates rather than counting**, so adding a
fourth rule without extending it leaves a visible gap rather than a silently stale number. **That
argument was then cashed**: Story 2-6 added a fourth rule and extended the clause list in the same
change, and the line quoted above is superseded by the one below.

## The demonstration, re-run 2026-09-03 for the editorial rule

Story 2.6 added `editorial voice`, and a rule never observed to fail is not known to work. One
fixture was planted in `contracts/registry.json`, the gate run against it, the output recorded here,
and the file restored. **Restoration was verified by SHA-256 rather than by eye**, on the same
reasoning as the run above: an elided digest cannot be re-checked and re-checking is the entire point
of recording it. **No fixture is in the tree at this story's closing commit**, and the gate exits 0
against the restored file.

```
SHA-256 of contracts/registry.json, before and after the fixture, at this story's final tree:
5330D3D1198C60098C104D6F6A785BEF74604A49918EC60E0DD318EDC81D15F8
```

**This digest is not the one recorded for Story 2-5**, and it should not be: nine of the fourteen
descriptions changed in this story. The 2026-09-03 digest above it,
`BFB28AF7BAA039F17C10D01287403B1BFC40EF3EBB4B63ABBB5BDBE05706D7A9`, was correct for the tree Story
2-5 closed on and is kept as history rather than corrected.

| Field | Value | Nature |
|---|---|---|
| Fixture D | Four entries breaking the rule in its four separable ways: `cuatro-portfolio`'s `description` replaced by four sentences carrying three of the six banned adjectives, two of them capitalised; `cuatro-tracker`'s replaced by a first-person sentence using three of the six words the first implementation missed, beside the word "Wednesday"; `cs-tracker`'s **`name`** rewritten to carry all three untypeset forms; and `digital-library`'s `description` left with no sentence end at all | **Decision.** The first entry proves the sentence count and the adjective list fire independently on one value and that the refusal names the author's capitalisation rather than the list entry; the second proves the corrected ten-word set fires and does not collide with a word containing "we"; the third proves the punctuation half reads a field that is not `description`; the fourth proves the underrun has wording of its own rather than citing "never four" |
| Result | The command exited **1** with **eleven** violations: one sentence-count overrun, three adjectives, three first-person words, three untypeset forms and one underrun, each naming the exact thing found | **Observed 2026-09-03** on the Windows 11 development host, by running `node ops/registry-schema.mjs` against the working tree |
| Removed | Yes, byte for byte | **Observed 2026-09-03** by SHA-256 comparison against the pre-fixture copy, which is the digest above |

**This supersedes a fixture C run recorded here earlier the same day**, which was taken against the
rule as first implemented and is not kept: unlike the 2026-08-29 and Story 2-5 quotations above, it
was not a record of a shipped rule failing but of a rule the review then corrected in four places, so
keeping it would preserve output no version of this gate now produces. The corrections themselves are
recorded under "The four rules beyond the schema" above, which is where a reader looking for what
changed will be.

Fixture D, quoted verbatim from the violation count down. The `BEYOND_THE_SCHEMA` line is repeated
under every violation and is elided here after its first appearance, marked where it was cut.

**The block below carries an em dash, an ellipsis and a pair of curly quotes, and that is not a
breach of `AGENTS.md:23-25`.** It is program output quoted verbatim inside a fenced block, and those
three characters are the replacements the refusal exists to name. Rewriting them would falsify the
one property this section claims. `DESIGN.md:491-497` is the reconciliation: the product renders
typeset punctuation and the repository's own prose takes none, and a record quoting the product is
still quoting the product.

```
  11 violations in contracts/registry.json, by JSON Pointer:
    /applications/0/description: 4 sentences, where FR-8 fixes one to three and says "never four": "A Powerful front door. It lists things. It is Beautiful. It is seamless."
      rule: editorial voice
      This is one of the four rules this gate applies beyond the schema, none of which draft-07 can express, and the editor will not catch it.
    /applications/0/description: the marketing adjective "Beautiful", as a whole word (FR-8 bans six by name: powerful, seamless, cutting-edge, modern, beautiful, blazing)
      rule: editorial voice
      [BEYOND_THE_SCHEMA, as above]
    /applications/0/description: the marketing adjective "Powerful", as a whole word (FR-8 bans six by name: powerful, seamless, cutting-edge, modern, beautiful, blazing)
      rule: editorial voice
      [BEYOND_THE_SCHEMA, as above]
    /applications/0/description: the marketing adjective "seamless", as a whole word (FR-8 bans six by name: powerful, seamless, cutting-edge, modern, beautiful, blazing)
      rule: editorial voice
      [BEYOND_THE_SCHEMA, as above]
    /applications/1/description: the first-person word "me" at a word boundary (FR-8: no first person, and a Registry entry describes the application rather than its author)
      rule: editorial voice
      [BEYOND_THE_SCHEMA, as above]
    /applications/1/description: the first-person word "mine" at a word boundary (FR-8: no first person, and a Registry entry describes the application rather than its author)
      rule: editorial voice
      [BEYOND_THE_SCHEMA, as above]
    /applications/1/description: the first-person word "us" at a word boundary (FR-8: no first person, and a Registry entry describes the application rather than its author)
      rule: editorial voice
      [BEYOND_THE_SCHEMA, as above]
    /applications/2/name: a double hyphen, "--", where copy a Visitor reads takes an em dash, "—" (UX-DR38 and DESIGN.md, over "name" and "description" only: an id, a family, an absorbed_into and a URL are machine-readable and are left alone, because typesetting one would break the value)
      rule: editorial voice
      [BEYOND_THE_SCHEMA, as above]
    /applications/2/name: a straight double quote, "\"", where copy a Visitor reads takes a curly quote, "“”" (UX-DR38 and DESIGN.md, over "name" and "description" only: an id, a family, an absorbed_into and a URL are machine-readable and are left alone, because typesetting one would break the value)
      rule: editorial voice
      [BEYOND_THE_SCHEMA, as above]
    /applications/2/name: three periods, "...", where copy a Visitor reads takes an ellipsis, "…" (UX-DR38 and DESIGN.md, over "name" and "description" only: an id, a family, an absorbed_into and a URL are machine-readable and are left alone, because typesetting one would break the value)
      rule: editorial voice
      [BEYOND_THE_SCHEMA, as above]
    /applications/3/description: no sentence end at all, where FR-8 fixes one to three sentences. A terminator, optionally followed by a closing quote or bracket, is what ends one: "A library with no full stop"
      rule: editorial voice
      [BEYOND_THE_SCHEMA, as above]
```

**Four things in that output are the point of it.** The fixture's second description reads "It shows
us the file and gives me mine, on a Wednesday."; the refusal names `us`, `me` and `mine`, which the
first implementation's four-word set let through entirely, and says nothing about the `we` inside
"Wednesday", which is the collision a substring match would have made. A standing case holds that
second half from the other side, by requiring a description carrying "Wednesday", "four", "because",
"some" and "mist" to pass. Every adjective is named **as the author wrote it**, `Powerful` and
`Beautiful` with their capitals, rather than as the lowercase list entry it matched against, which is
exactly what a schema `not` could not have said. Three violations sit on a `name` rather than on a
`description`, which is the punctuation half's scope made visible, and no violation sits on a
`source` or an `id`, which is the narrowing. And the last violation says "no sentence end at all"
rather than citing "never four", because the value broke the other end of the range.

And the committed pair today:

```
registry schema: read contracts/registry.json against contracts/registry.schema.json, 14 applications, valid, no duplicate id, every reference resolves, every family groups, every description in FR-8 voice, every name and description typeset (AD-4, AD-5).
```

**Every message a violation carries comes out of the schema.** **Decision.** The second and third
lines of each violation are the rule's own JSON Pointer and the `description` of the schema node
that rejected the value, or, for a missing required field, the `description` of the field that is
absent. That is why AD-5's "absence is never a permitted way to say not applicable" reaches an
operator's log: it is written once, in `contracts/registry.schema.json`, where the editor shows it to
an author too.

## The published surface is now eleven files

`contracts/` was nine files and is eleven. **Observed 2026-08-29** by `node ops/contract-purity.mjs`,
which prints, verbatim:

```
contract purity: read contracts/, 11 files, none executable and no link (AD-1).
```

and by `corepack pnpm build`, after which `public/contracts/` holds the same eleven.

**The two new files are the only hand-authored things on the published surface.** Everything else
under `contracts/` is generated by `packages/tokens/build.mjs` or `packages/fonts/build.mjs`. Those
generators name the files they write and never clean the directory, so the JSON pair survives a
rebuild and both drift jobs stay green: **Observed 2026-08-29** by running `corepack pnpm tokens:build`
and `corepack pnpm fonts:build` and reading `git status --porcelain --ignored=matching -- contracts/`,
which reports the two files as added and nothing else. The comment at `packages/tokens/build.mjs:3-5`
claimed nothing under `contracts/` is hand-edited and was corrected in this story.

Three committed listings pin the contents of `contracts/`, and all three moved:
`packages/tokens/__tests__/tokens-contract.test.ts`, `packages/fonts/__tests__/fonts-contract.test.ts`
and `ops/__tests__/cs-tracker-adoption-probe.test.ts`.

**The `cs-tracker` verbatim-copy comparison narrowed, and the narrowing is forced.** AD-4 has
Satellites fetch `registry.json` over HTTPS at **build** time, and AD-14's `cuatro-contracts/` folder
is the token contract, so the moment the Registry landed under `contracts/` a whole-tree comparison
would have reported two files a Satellite must never vendor. `ops/cs-tracker-adoption-probe.mjs` now
takes its **source** side from `TOKEN_CONTRACT_PATHS`, the nine token-contract paths named in one
exported constant with that reason beside it, and refuses if any of the nine is absent from
`contracts/` so the comparison cannot shrink silently. The **vendored** side is still hashed whole,
so a file a Satellite added to its own folder is still reported as extra. `CONTRACT_FILE_COUNT` keeps
meaning the token contract's nine and is now derived from that list rather than written as a literal.

## What holds the failure paths permanently

`ops/__tests__/registry-schema.test.ts` carries **99 cases**, one per row of each story's I/O matrix
plus one per refusal no matrix row names plus the wiring cases, and it sits inside the
already-blocking `test` job. The demonstrations above prove the gate could fail on the days they were
run; these are what keep it able to fail after a later edit. Every refusal case is built from strings
or from a scratch tree under `tmpdir()`, so a test run never mutates the committed pair.

| What the block holds | Cases |
|---|---|
| The committed pair validates, carries entries, keeps `source` at the repository's capitalisation, keeps all fourteen descriptions in FR-8 voice with no sentence repeated across entries, names the four rules with the clause each contributes, and an emptied list is a refusal | 7 |
| The dialect, the value sets, the URL pattern, the keyword set and the enum descriptions | 9 |
| Every refusal the matrix names, plus the escaping, the truncation, the byte order mark and the sorting | 50 |
| The pure parts: pointers on every violation, the audit, `else`, the schema form of `additionalProperties`, the uncountable-Registry refusal, and the four rules beyond the schema | 13 |
| The gate as the job runs it, through the real binary | 11 |
| The `ci.yml` wiring | 9 |

**Three of the four committed-pair cases were inverted rather than deleted on 2026-09-03.** They
asserted that `applications` was `[]`, that `minItems` was absent, and that an empty list passed. Each
now asserts the opposite and carries the reason the old assertion was right when it was written. A
fourth case, the byte order mark one, asserted `0 applications` against the committed file and now
matches the count instead, so adding an application is not a failure in a case about an invisible
character.

| Figure | Value | Nature |
|---|---|---|
| Cases added | **79** in `ops/__tests__/registry-schema.test.ts`, plus **6** in `ops/__tests__/cs-tracker-adoption-probe.test.ts` for the narrowing | **Observed 2026-08-29** at the review pass, counted per file by Vitest. It was 68 and 4 before that pass |
| Cases in the file | **87** in `ops/__tests__/registry-schema.test.ts` | **Observed 2026-09-03** by Vitest. Story 2-5 added eight: three gate-level refusals for the new rules (dangling, self-reference, lonely family), one positive control proving they can be satisfied, one exercising all three structural rules in a single run, two unit-level cases for the rules themselves, and one holding `source` at the repository's capitalisation. Three existing cases were inverted rather than added to, and a fourth stopped asserting a literal entry count |
| Whole suite | **890 passed, 34 files** by `corepack pnpm test --run`, from 805 in 33 files before this story | **Observed 2026-08-29** at the review pass, on the development host. No browser started. The before figure is the after figure less the 85 cases this story added, rather than a second measured run. `AGENTS.md` stated 738 in 32 files, which was already stale at this story's baseline, and was corrected to the measured figure by this story |
| Whole suite | **898 passed, 34 files** by `corepack pnpm test --run` in 84 to 136s | **Observed 2026-09-03** on the development host, after Story 2-5 and its review pass. No browser started. Eight more than the 890 above, and no file added. **One of four runs reported a single failure that the other three did not**, and it was not identified because that run's output was truncated; filed in `deferred-work.md` rather than assumed away |
| Whole suite | **910 passed, 34 files** by `corepack pnpm test --run` in 81s | **Observed 2026-09-03** on the development host, after Story 2-6 and its review pass. No browser started. Twelve more than the 898 above, and no file added. It was 906 before the review pass, which added four cases. **The one-in-four failure recorded on the row above did not recur** across the three full runs this story made; it stays filed in `deferred-work.md` rather than closed, since green runs are not evidence about an intermittent |
| Cases in the file | **99** in `ops/__tests__/registry-schema.test.ts` | **Observed 2026-09-03** by Vitest, after Story 2-6 and its review pass. Twelve more than the 87 above: seven gate-level refusals for the new rule (four sentences, no sentence end at all, a banned adjective as a whole word, first person across the ten-word set, an untypeset form in `name` or `description`, two forms inside one string, and the mandated punctuation counted as a sentence end); two gate-level positive controls, one over the `entry()` fixture every other case is built from and one over honest prose merely containing a banned stem; one pinning the four rules and the clause each contributes; one unit-level case for the rule itself; and one asserting the shipped fourteen conform and repeat no sentence. The all-rules-in-one-run case was extended from three rules to four rather than added to. It was 95 before the review pass, which added four |
| Cases failing before the rule was wired in | **10**, being 9 of the 12 new cases plus the extended all-rules case | **Observed 2026-09-03** by deleting the `editorial voice` entry from `RULES_BEYOND_THE_SCHEMA` and re-running the file. The three that stay green are the two that call `editorialVoice` directly, which exercise the rule whether or not the pipeline runs it, and the honest-prose positive control, which passes either way by design. **The green-line positive control now goes red with them**, which it did not in the first implementation: the clauses were a literal inside `report()`, so the line named four rules whether or not four ran. The module was restored and the gate re-run before anything was committed |
| Typecheck | Pass, with the new test file inside the program | **Observed 2026-08-29** by `corepack pnpm typecheck`, and **re-confirmed 2026-09-03** after Story 2-5 added two exported rules to the `.mjs`, and again after Story 2-6 added a third. `tsconfig.json:34-41` puts `**/*.ts` in the program, and the `.mjs` gate carries JSDoc types for it |
| Gate dependencies | None. `node:fs`, `node:path` and `node:url`, and no `node:process` | **Decision**, asserted by three standing cases reading the module's own source |

**A positive control sits beside all of them**: the committed pair must validate, and the shipped
schema must pass its own keyword audit, so the refusal cases cannot all be passing on a harness that
is broken in some other way.

**The keyword set is asserted twice, in two directions.** One case pins `KEYWORDS` as a literal, so a
widening is deliberate. A second walks the shipped schema with a collector written in the test rather
than with the module's own audit, pins the keywords it actually uses as a literal, and requires every
one of them to be in `KEYWORDS`. That is what stops a schema edit outrunning the validator: the
module's own audit would catch it at runtime, and these two catch it in the suite, where the failure
names the keyword.

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **A red job holds no merge and no deploy on its own** | The job fails, and nothing mechanical follows until `registry-schema` is a required status check on `main`. `deploy.yml` fires on the same push with no `needs:`, so a deploy proceeds beside a red CI run. That is true of all six jobs in the file | **Observed 2026-08-29** by reading the two workflow files. Pending Operator action 2 |
| ~~**The application list is empty, and `minItems` is deliberately absent**~~ **Closed 2026-09-03.** | Struck rather than deleted. It read: the envelope carries zero entries, so `minItems: 1` would fail its own gate, and Story 2.5 tightens it when it writes the entries. That is what happened. `applications` now carries `minItems: 1`, an emptied Registry is a refusal, and the standing case that asserted the absence asserts the value | **Decision**, taken 2026-08-29 and discharged 2026-09-03 by Story 2.5. Pending Operator action 3 |
| **The entry count is pinned nowhere, so `minItems: 1` is a partial mitigation** | Fourteen entries exist and nothing holds that number, or the entries themselves, equal to `ops/registry-inputs.md`, which is the record they were transcribed from. A row edited in one file and not the other is invisible. **The harm `minItems: 1` is argued from is not fully covered by it**: an edit that empties the array is now a refusal, and an edit that cuts fourteen entries to one is not, though it produces very nearly the same directory. Considered by the Operator on 2026-09-03 and **deliberately deferred**: it stays stated limit 1 of `ops/registry-inputs.md` rather than becoming a check here | **Decision.** The suite asserts `\d+ applications` on purpose, so adding an application is not a test failure in a case about something else |
| **A Registry with no renderable entry validates** | FR-35 renders `Live` and `Complete`. Nothing requires at least one entry to carry either, so fourteen entries all flipped to `In progress` pass the gate and give the Hub an empty Suite Directory, which is the outcome `minItems` was set to prevent by a different route. Not closed here: it is a product rule about what the directory must contain, not a shape rule about the Registry, and AD-5 does not state it | **Decision**, 2026-09-03. Recorded because the argument for `minItems` invites the question |
| **Only two status combinations are constrained, and the enum descriptions must not imply more** | AD-5 fixes exactly two: `live` is required when `status` is `Live`, and forbidden when it is `Archived`. Everything else validates, and three combinations are worth naming because a reader will expect otherwise. **A `Complete` entry carrying a `live` URL validates**, which is why that value's description no longer says "not deployed": it said so while the schema enforced nothing of the kind. **A `Live` entry declaring `demo: not-deployed` validates**, though the two read as a contradiction. **An `Archived` entry declaring `demo: open` validates**, though it has no `live` URL to open. A schema may not claim more than it enforces, and tightening any of the three is a change to AD-5 rather than to this file | **Decision.** Found by the story's review pass, which is also when the `Complete` description was corrected |
| **All four rules beyond the schema are invisible to the editor** | None can be expressed in draft-07, so AD-4's authoring half covers none of them. An author writing a second entry with an id they already used, an `absorbed_into` pointing at nothing, a `family` whose partner they forgot, or a fourth sentence in a `description`, sees nothing until CI runs. **Widened 2026-09-03** from one rule to three, and again the same day to four | **Decision**, stated above and in every one of the four refusals |
| **The gate constrains a description's form and says nothing about whether it is true** | It now holds every `description` to FR-8's shape: one to three sentences, no banned adjective, no first person, typeset punctuation. It still cannot tell that a description is **wrong**. A `description` that lies, a stale `status`, a `tech` array naming the wrong framework and a `live` URL that does not resolve all validate. FR-32's scheduled link check is Story 2.23 | **Decision.** Reworded 2026-09-03 so it does not read as contradicting the new rule, and **Story 2.6 is the proof of it**: three of the fourteen descriptions were refuted by the software they described, and all three were green under every rule this gate applies. Each was found by a person reading a claim against a checkout. An editorial rule constrains form, never truth; what it buys is that the cheap regressions stop, so the expensive check stays affordable |
| **The story's headline defect is guarded in this repository and nowhere else** | Five of the fourteen descriptions ended with the same sentence before Story 2.6, which is most of what that pass was for, and **no rule in this gate refuses it**. What refuses it is one case in `ops/__tests__/registry-schema.test.ts`, which splits every shipped description on the module's own exported `SENTENCE_END` and fails if a sentence appears twice. So the green line does not name it, `BEYOND_THE_SCHEMA` does not carry it, and a Satellite validating the fetched Registry against the published draft-07 schema gets nothing from it. **It is a statement about the entries as a set, exactly the shape of the first three rules, and it could be a fifth one** | **Decision**, 2026-09-03. Not made a fifth rule because the story's I/O matrix authorises four, and a refusal the matrix does not name is one nobody agreed to. Recorded here rather than left for a reader to infer from the absence of a clause, which is the same argument the enumerated green line rests on |
| **The straight single quote is not one of the three untypeset forms** | `DESIGN.md:491` says "curly quotes", which ordinarily covers the apostrophe, and an apostrophe inside a word is the commonest case of all. The gate refuses only `"`, `--` and `...`, so `it's` with a straight apostrophe passes. **Nothing costs anything today**: no shipped `name` or `description` carries an apostrophe at all | **Decision**, 2026-09-03. The story's matrix names three forms and widening a refusal past the row authorising it is how a gate starts refusing what nobody agreed to. The cheap moment to add it is the first entry that wants an apostrophe |
| **The sentence counter depends on a rule it does not itself enforce** | `editorial voice` counts sentence terminators, which an abbreviation or a version number breaks. It is honest against `description` only because FR-8 puts the stack in `tech`, so `Next.js` cannot appear in a `description` without already being a defect. **The rule must never be lifted onto another field**: `tech` carries `Next.js` and `ethers.js` today and the same counter over it would be wrong on its first run | **Decision**, 2026-09-03. Recorded because the rule reads as more general than it is |
| **It reads the committed tree on a runner, not what is served** | A file changed at `https://cuatro.dev/contracts/registry.json` on the box, without a commit, is invisible here. The same limit `ops/contract-purity.md` records for its own gate | **Decision** |
| **The vendored comparison no longer covers the whole published surface** | `ops/cs-tracker-adoption-probe.mjs` compares the token contract's nine paths against `cs-tracker`'s vendored folder. Nothing compares the served `registry.json` against what a Satellite fetched, because a Satellite fetches it at build time and vendors nothing | **Decision**, forced by AD-4 and AD-14. Recorded above |
| **`enumDescriptions` is not a JSON Schema keyword** | It is VS Code's own annotation. An editor that does not implement it shows no per-value description, and every validator ignores it. Nothing asserts on it in either reader, so the cost of it being ignored is a missing hint and never a missing rule | **Decision** |
| **The schema is applied by a validator written here, not by `ajv`** | Adding a dependency was refused: the job installs nothing on purpose, so a package specifier reached at runtime is a crash on exactly the run the no-install argument exists to cover. The cost is that the implemented set is small and a keyword outside it is a refusal rather than a rule | **Decision.** The story's boundaries forbid adding a dependency, `ajv` included |
| **The job has never run on a GitHub runner** | Everything recorded here was observed by running the job's own command locally against the committed tree | **Observed 2026-08-29.** Pending Operator action 1 |
| **The editor half has not been observed** | AD-4's authoring half is an editor validating while the entries are written, and no CLI on this host can assert that VS Code marks a bad entry as it is typed. What is asserted here is that the hook is wired: `$schema` is required on the envelope with a fixed value, so deleting it is a red build. Whether an editor honours it is unobserved | **Observed 2026-08-29** for the hook, by a standing case. The editor's behaviour is **not observed at all**. Pending Operator action 5 |

## Pending Operator actions

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Record the first real run of the `registry-schema` job**, from the Actions run summary | Operator | The job has only ever run as a local command. Same shape as the action `ops/contract-purity.md` left open for its own job | _not done_ |
| 2 | **Make `registry-schema` a required status check on `main`**, in the branch protection settings | Operator | Until it is, AD-21's "blocking" means the job goes red and nothing stops. `ops/contract-purity.md`'s action 2 asks for the same thing for the other five jobs, and this is the sixth: they are worth doing in one sitting | _not done_ |
| 3 | **When Story 2.5 fills the application list, tighten `applications` with `minItems: 1`** | Story 2.5 | The one entry rule this schema deliberately leaves open. It cannot be set while the envelope is empty, and it should not be left open once it is not. Done in the same commit that authored the fourteen entries, and demonstrated failing against an emptied envelope | **2026-09-03** |
| 4 | **When a Satellite starts fetching `https://cuatro.dev/contracts/registry.json`, confirm it validates what it fetched** | Operator | This gate validates the committed file. A Satellite fetching at build time is reading a served copy, and nothing here sees that copy. Draft-07 was chosen precisely so a Satellite in any language can run the same schema | _not done_ |
| 5 | **Confirm AD-4's authoring half in the editor**: open `contracts/registry.json` in VS Code, paste an entry with `"status": "Live"` and no `live`, and check that the editor marks it before anything is saved | Operator | Half of AD-4 is the editor validating while entries are written, and no command on this host can assert it. **Its original window has closed twice.** It asked to be done before Story 2.5 wrote the real entries, and 2.5 ran on 2026-09-03 without it; it was then re-aimed at Story 2.6, which edited nine of the fourteen descriptions on the same date, also without it. **This story could not close it and did not try**: the editor's behaviour is a GUI observation and every check here runs through a command. It stays open, and the next window is any story that hand-edits the Registry. **The gap it names widened rather than narrowed on 2026-09-03**: the gate now applies four rules the editor cannot see instead of three, and the fourth is the one an author trips most often, since it fires on a fourth sentence rather than on a structural mistake | _not done_ |
| 6 | **Rule on whether `contract_version` moves for a text-only pass.** Story 2.6 changed nine of the fourteen `description` values and left the version at `1.1.0` | Operator | The field's own rule is "a value change is a minor bump; any field rename is major (AD-16)", which read literally makes nine changed values a bump to `1.2.0`. Story 2-6's boundaries put moving the version behind an Ask First, so it was left alone rather than moved on the story's own judgement. **The cost of leaving it**: AD-4 has Satellites fetch this file over HTTPS at build time, and the version is the only signal one of them has that a description it renders has changed. **The cost of the rule as written**: every editorial correction becomes a minor bump, and the version stops meaning anything a consumer can act on. Worth settling once rather than per story | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. When a figure is re-measured, add the new row
with its own date and method and keep the old one, so a later reader can see whether a number moved
or was simply re-stated. Deletion is not used here.

## The actions moved off Node 20, 2026-08-31

**Changed 2026-08-31**, one day after this gate first ran, and for the whole file rather than for
this job: `actions/checkout@v4`, `actions/setup-node@v4` and `pnpm/action-setup@v4` all target
Node.js 20, which is deprecated. This job now uses `checkout@v7` and `setup-node@v7`. The reasoning
and the run that surfaced it are in `ops/contract-purity.md` under the same heading, recorded once
rather than in both files.

**The Installs row above gains `package-manager-cache: false`.** From `setup-node` v5 the action
caches automatically whenever `package.json` carries a `packageManager` field, so this job, which has
no `pnpm/action-setup` step, would have had the action looking for a pnpm nothing installed. The
input is written in by name and pinned by a standing case, so "installs nothing, which is what makes
it run when the install fails" is now held by a declared input rather than by the absence of a line.
