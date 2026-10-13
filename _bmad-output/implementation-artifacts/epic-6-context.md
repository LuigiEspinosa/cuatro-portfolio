# Epic 6 Context: Token distribution machinery, deferred, earned

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give the token contract distribution machinery (an npm package for JavaScript consumers, a Renovate
shareable preset, published reusable CI workflows) only once hand-copying has proven frequent enough
to pay for it. The epic is not scheduled: it opens when three contract releases after `v1.0.0` have
actually been hand-propagated into at least one Satellite's vendored `cuatro-contracts/` folder.
Fewer than three means the epic stays closed, and that is the correct outcome, because the mechanism
is earned by frequency, not by intent. The published shape is already fixed, so nothing is blocked
by waiting.

## Stories

- Story 6.1: Confirm the trigger has fired
- Story 6.2: Publish the token contract as an npm package
- Story 6.3: A Renovate shareable preset
- Story 6.4: Publish the reusable CI workflows to `contracts/workflows/`

## Requirements & Constraints

- Token changes propagate without breaking a Satellite silently: adoption is an explicit reviewed
  action, never an unattended merge, and the Operator can tell which Satellite is on which version.
- No automated dependency merge in any repository lacking a real test suite whose run is a required
  check on the default branch; Renovate may only open pull requests the Operator merges.
- The trigger counts a release event, not a change: anything present at first publication, any
  documentation-only change, and the unpublished `v1.0.1` rehearsal never count.
- The counter lives in one record, appended as each event occurs, with its current value written
  explicitly; it is never reconstructed from history when the epic is considered.

## Technical Decisions

- Consumers copy `contracts/tokens.css`, `fonts.css` and `tailwind.css` together as a folder named
  exactly `cuatro-contracts/`; the fixed name is what lets the scheduled Registry verification read
  each adopter's `Contract vX.Y.Z` header against its Registry `token_contract`.
- Versioning: a value change is minor, any rename (an adapter key included) is major, and the model
  is deprecate, migrate, remove; Contract 2.0.0 waived the deprecation window once by ruling.
- The Registry is fetched over HTTPS and never vendored, so a Registry release is not a
  propagation event.
- Nothing under `contracts/` may be executable; a published workflow YAML is a reference, and
  generators live in `packages/`.
- The npm package is a convenience for JavaScript consumers only; the folder and the published URL
  remain the contract for Elixir and Go consumers.
- An epic whose first story opens after 2026-11-15 records the bounded settled-inputs refresh first.

## Cross-Story Dependencies

- 6.2 and 6.4 depend on 6.1 having found the trigger fired; 6.3 depends on 6.2.
- The count rises through other epics' work: Epic 8 makes more Satellites vendor the contract, so
  later releases propagate to more adopters by construction.
