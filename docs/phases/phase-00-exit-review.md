# Phase 0 Exit Review

**Reviewed:** September 4, 2026
**Result:** Passed for Phase 1A
**Scope:** Functional MVP mechanics path

## Decision

Phase 0 is complete for the standalone Functional MVP mechanics path. Phase 1A
may start without waiting for AGS, public deployment, competitive balancing, or
commercial content approval.

## Exit evidence

| Gate | Result | Evidence |
|---|---|---|
| Working objective and audience assumption | Pass | Football 11, English-language global football-fan prototype |
| Formation and position eligibility | Pass | Explicit 4-3-3 seats and documented broad-role-to-formation inference policy |
| Duplicate, reroll, and cooldown rules | Pass | One identity per run; selected removal; two-round rejected-card cooldown |
| Content provenance | Pass | Two pinned OpenFootball revisions, public-domain notice, generator version, seed, disclaimer, and card hash |
| Content contract | Pass | JSON Schema plus cross-record validator; 1,041 named records validate |
| Formation coverage | Pass | Every canonical position has multiple candidate records |
| Scoring inputs | Pass | Versioned assessment and nineteen-opponent league configurations |
| Reference fixtures | Pass | Three valid XIs score deterministically; duplicate XI is rejected |
| Implementation boundaries | Pass | React DOM UI, framework-free domain package, local MVP adapters, AGS in Phase 2 |
| Browser baseline | Pass | Recorded desktop/mobile browser and viewport matrix |
| Automated checks | Pass | Four catalogue tests, five OpenFootball adapter tests, and ten Phase 0 configuration/fixture/design-case tests |

## Carried decisions that do not block Phase 1A

- Public-product rights for club and competition names/marks.
- Final public catalogue size; 60–80 remains an estimate, not a gate.
- Launch geography and go-to-market language beyond the English prototype.
- Competitive balance and target result distributions.
- Public share-card facts and connected-release configuration.

If club-name rights are unavailable when public release work begins, replace
club identifiers through a new content version without changing the domain
schema or mechanics interfaces.

## Phase 1A entry handoff

Start with:

1. framework-free TypeScript domain contracts;
2. `rng-v1` and published golden vectors;
3. formation eligibility and forward-feasibility matching;
4. deterministic constraints, offers, rerolls, state hashes, and replay;
5. exact reproduction of the Phase 0 reference assessment fixtures.

Phase 1A remains blocked only if its implementation reveals a content state that
cannot support at least three-card continuation or a deterministic reroll. That is an
engine/content defect to diagnose, not a reason to reopen the confirmed UI or
AGS boundaries.
