# Content, Legal, and Product Risks

**Last updated:** September 4, 2026
**Status:** Risk register

## Content strategy

The mechanics MVP uses the complete validated 2023/24 OpenFootball named-squad
catalogue so offer analysis can measure scarcity and viability without
guessing. A public release can later curate the pool based on offer-analysis
evidence and approved rights. Every retained card needs enough structured
information to create meaningful draft choices.

**Prepared Functional MVP candidate:**

- OpenFootball England Premier League results and squads for 2023/24,
  pinned to revision `0690446f794fde748ea4b994244def699c6a65b2`.
- OpenFootball Players population data pinned to revision
  `125d20f7cc06cac7e758b40df535a7695632680a`.
- 380 matches, 20 clubs, and 1,041 named squad cards.
- The complete 1,041-card pool for mechanics analysis; the earlier 60–80 figure
  is only a possible later release-curation estimate.
- Deterministically generated synthetic position ratings and attributes stored
  in a versioned manifest and clearly described as non-official.
- Text-first presentation.
- Original UI and branding.

Do not regenerate synthetic ratings at runtime. Record the source metadata,
reuse terms, generator version, seed, and output manifest so every run remains
reproducible and the source can be replaced without changing old results.

OpenFootball supplies match results, squad identities, broad positions, and
available birth years. It does not supply individual performance evidence for
official ratings. The prepared manifest and every player-facing prototype must
separate those observed facts from inferred formation positions, missing
physical profiles, ratings, attributes, tactical traits, and leadership, which
are deterministic, synthetic, and non-official.

## OpenFootball public-domain source

The OpenFootball England and Players repositories describe their data as free,
open, and public domain. The catalogue records exact commit revisions and keeps
links to both repositories and the CC0 1.0 public-domain dedication for clear
provenance even though attribution is not imposed like CC BY.

Public-domain dataset status does not resolve publicity/personality rights for
commercial use of player identities or trademark rights in league and club
names and branding. P0-05 therefore remains a player/club/competition release
decision, not a Functional MVP blocker.

## football-data.org assessment

football-data.org is a subscription API, not an openly licensed dataset. The
terms displayed during registration require one API key per application,
visible `Football data provided by the Football-Data.org API` attribution, and
state that API-derived fixtures, results, tables, player/squad data, and scorers
may no longer be referenced after subscription cancellation. The service also
states in its published commercial-use note that free access is non-commercial
and asks commercial users to negotiate a solution.

Conclusion: do not ingest football-data.org into the checked-in catalogue under
the free tier. Reconsider it only for live operational data after obtaining
written commercial terms that cover caching, derived data, termination, and the
intended game application.

## Rights requiring validation

- Player names and likenesses.
- Player photographs.
- Club, league, competition, and federation logos.
- Official kits and visual trade dress.
- Statistical datasets and API terms.
- Generated artwork derived from protected source material.

Until rights are confirmed, prefer text, original graphic systems, generic club
identifiers where necessary, and properly licensed or original media.

This document is a product-risk record, not legal advice.

## Primary product risks

| Risk | Why it matters | Early mitigation |
|---|---|---|
| Eleven rounds feel too long | Players abandon before the shareable outcome | Time playtests and improve reveal pacing |
| Choices are obvious | Draft loses tension and replay value | Tune offer generation around trade-offs |
| Simulation feels arbitrary | Fans reject results rather than debate them | Show categories and evidence-based explanations |
| Dataset is too small | Runs repeat quickly | Measure repetition before expanding curation |
| Dataset is too large too early | Schema changes become expensive | Start with the smallest set that passes coverage and completion checks |
| Public-domain data is mistaken for a grant of league or club rights | Dataset reuse is open but names or marks can create separate claims | Preserve provenance; separately review competition and club naming/trademark use |
| Modeled values are mistaken for observed player ability | The source has named squads but no individual performance evidence | Separate observed identity fields from inferred positions and synthetic ratings; never call them official ratings |
| Public-domain source status is treated as resolving player publicity rights | Dataset reuse and commercial identity use are different legal questions | Require explicit player, club, and competition rights review before an official public release |
| A football-data.org API subscription is treated as a reusable data license | Cached or derived data remains after cancellation or crosses applications | Do not use it as catalogue input without written commercial caching and post-termination rights |
| Synthetic ratings are mistaken for official data | Players distrust the game or infer unsupported claims | Label them clearly and keep provenance and generator versions |
| Position eligibility causes arguments | Football roles are subjective | Publish consistent eligibility rules |
| Famous names dominate all logic | Tactical balance becomes cosmetic | Keep quality and team fit visibly separate |
| Friend rooms add complexity before solo loop is fun | Online polish cannot rescue weak drafting | Validate solo vertical slice first |
| Ranking can be manipulated | Competitive value collapses | Server authority, replay protection, opponent cooldown |
| Old and new simulation versions compete unfairly | Leaderboard trust erodes | Define immutable and compatibility policies |
| Social previews fail | Viral loop breaks outside the app | Serve result-specific HTML and preview images |

## Technical risks

- Browser storage loss for anonymous identities.
- AGS token lifecycle and reconnect behavior.
- Public versus confidential IAM client separation.
- Trusted-service-to-AGS permission gaps.
- Cloud Save record limits, conflicts, versioning, and recovery strategy.
- Session progress notification behavior.
- Share-image generation latency.
- Deterministic output drifting across runtime or content versions.

Exact SDK behavior, permissions, and namespace configuration must be verified
during the relevant AGS integration slice rather than assumed from this design.

## Playtest questions

- Can a new player explain the goal after one screen?
- Does every third draft round contain a difficult choice?
- Can players predict how a selection changes team fit?
- Do players understand why the final XI dropped points?
- Is completing eleven rounds worth the reveal?
- Do players immediately want to send the result to someone?
- Does the live room feel meaningfully more social than sharing a daily link?
