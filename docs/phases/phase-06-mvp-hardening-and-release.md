# Phase 6 Detailed Plan — Connected Release Hardening

> Connected-project reference: implementation claims and source paths below refer to the connected branch, not this offline starter. See the [starter path](../12-accelbyte-integration-guide.md#offline-baseline) for the current sequence.

**Last updated:** September 2, 2026  
**Status:** Proposed final release gate  
**Parent roadmap:** [07 — MVP roadmap](../07-mvp-roadmap.md)

## Work estimate — one developer with agentic AI

- **Effort:** 4–7 builder-days.
- **Elapsed time:** 1–1.75 weeks.
- **Primary uncertainty:** security findings, supported-browser failures,
  recovery rehearsal, operational readiness, and final human sign-off.

## Phase outcome

The complete connected release is deployable, secure, recoverable, operable, accessible, and
verified through its intended player journeys in a production-like environment.

Feature implementation is not enough to close this phase. The release needs
evidence, rollback instructions, configuration ownership, and an explicit
decision about Device ID account-loss risk.

## Entry conditions

- Phases 0–5 meet their feature exit criteria in development.
- Content and simulation versions are pinned for the release candidate.
- The target Cloudflare and AGS environments are identified.
- All required migrations and AGS resources are listed.
- No unresolved issue can silently corrupt identity, competitive state, or
  reproducibility.

## Workstreams

### 6A — Release configuration and secrets

1. Inventory browser-safe configuration separately from secrets.
2. Confirm the browser build contains only the AGS public client ID.
3. Store trusted-service credentials only in hosted Sites secrets or the approved
   server-side secret mechanism for any selected fallback; never expose them through
   the Sites client.
4. Confirm development, staging, and production namespaces/Cloud Save records cannot be
   mixed accidentally.
5. Add startup/configuration checks that fail visibly without logging secrets.
6. Record credential rotation ownership and procedure.

### 6B — Data migration and recovery

1. Test every Cloud Save schema/version migration from an empty account and the
   previous supported record version.
2. Back up or export required release-candidate game data before migration.
3. Record rollback or forward-fix steps for each record-version migration.
4. Prove immutable results and their version evidence survive deployment.
5. Add reconciliation for pending AGS Statistics settlements.
6. Test restore procedures in a non-production environment.

### 6C — Security and abuse review

1. Recheck every browser/trusted-service boundary.
2. Verify AGS caller type, token source, IAM client type, operations,
   permissions, and access in the target environment.
3. Scan built assets and logs for secrets, tokens, authorization headers, and
   private identifiers.
4. Test tampered selections, result IDs, session IDs, opponent IDs, replayed
   requests, expired tokens, and wrong-namespace tokens.
5. Apply endpoint-specific rate limits and idempotency.
6. Review public-result privacy, sanitization, and takedown behavior.
7. Ensure errors expose support references rather than raw internals.

### 6D — Integrated player-flow regression

Verify these journeys from clean browser profiles:

1. Guest login, reload, logout, and same-identity return.
2. Random draft through authoritative result.
3. Daily draft through stable shared result and preview.
4. Statistics update and visible Leaderboard readback.
5. Host creates friend room; second user joins, drafts, reconnects, and compares.
6. Player saves an XI and completes a nearby-XI challenge.
7. Expected network, auth, room, and settlement failures recover visibly.

Record service evidence and player-flow evidence separately for every AGS
journey.

### 6E — Browser, accessibility, and responsive QA

- Test the approved desktop and mobile browser matrix.
- Test narrow, standard, and wide layouts.
- Complete the draft, room, leaderboard, and result flows by keyboard.
- Verify focus order, visible focus, labels, dialog behavior, status
  announcements, contrast, reduced motion, and zoom.
- Check touch targets and virtual-keyboard behavior for optional session join codes.
- Verify share pages and essential game states remain understandable when
  animations fail or reduced motion is enabled.

### 6F — Performance and resilience

1. Establish recorded budgets for initial application load, interaction
   responsiveness, challenge creation, submission, result load, and share image
   generation.
2. Measure against realistic content and throttled mobile conditions.
3. Remove unused client modules; load AGS and room features only where sensible.
4. Verify caches do not mix users, environments, daily periods, or renderer
   versions.
5. Test transient trusted-service, Cloud Save, AGS, and image-rendering failures.
6. Confirm retry behavior does not duplicate runs, rooms, matches, or statistic
   effects.

### 6G — Content and legal release gate

- Freeze the release content manifest and provenance record.
- Confirm approved use of player names and all visual assets.
- Exclude unresolved photos, logos, kits, and protected trade dress.
- Verify public share assets use only approved material.
- Document correction, removal, and takedown paths.
- Confirm legal and product owners accept the remaining content risk.

### 6H — Operations and observability

Product Analytics remains deferred, but operational visibility is required.

Record and monitor:

- trusted-service request success, latency, and error categories;
- Cloud Save read, write, conflict, schema, and recovery failures;
- challenge, submission, simulation, and settlement failures;
- AGS login, Session, Statistics, and Leaderboard integration errors without
  logging tokens;
- share-image generation failures;
- correlation/support identifiers across browser and trusted-service boundaries.

Create runbooks for auth outage, AGS permission failure, daily challenge
creation failure, stuck room, pending Statistics settlement, bad content
release, and Cloud Save schema/recovery failure.

### 6I — Deployment and rollback rehearsal

1. Deploy the release candidate to staging from the same build pipeline intended
   for production.
2. Apply migrations and configuration in documented order.
3. Run automated smoke tests and the integrated player-flow checklist.
4. Rehearse application rollback and data forward-fix behavior.
5. Verify old public results still render after rollback or forward deploy.
6. Record the production go/no-go owners and communication path.

## Release evidence matrix

| Area          | Required evidence                                                     |
| ------------- | --------------------------------------------------------------------- |
| Domain        | Unit and golden fixtures pass                                         |
| Contracts     | Browser/Worker contract tests pass                                    |
| Persistence   | Fresh and upgrade migrations pass; recovery rehearsed                 |
| Random/daily  | Full player flows and replay evidence pass                            |
| Sharing       | Public HTML and external preview checks pass                          |
| IAM           | Login token plus authenticated lookup through visible UI              |
| Statistics    | Trusted write plus readback and exactly-once evidence                 |
| Leaderboards  | Intended player value appears in the visible ranking UI               |
| Friend rooms  | Multi-browser create/join/start/reconnect/compare passes              |
| Saved XI      | Discovery, deterministic match, and settlement pass                   |
| Security      | Abuse suite and secret scan pass                                      |
| Accessibility | Approved keyboard, screen-state, contrast, and responsive checks pass |
| Operations    | Dashboards/log queries, alerts, and runbooks are usable               |
| Rollback      | Staging rehearsal preserves or recovers required state                |

## Production Device ID gate

Before public release, choose exactly one documented policy:

1. Implement and verify an account-upgrade/linking path that attaches a durable
   identity provider to the existing AGS guest account; or
2. Explicitly accept that clearing browser storage or changing devices may make
   guest progress unrecoverable, communicate this before competitive/social
   use, and provide an appropriate reset/support experience.

Silence is not an acceptable policy.

## Go/no-go blockers

- Any confidential secret appears in a browser build or public repository.
- AGS operations or required permissions remain unknown or unverified.
- Competitive updates can double-apply or cannot be reconciled.
- Stored results cannot be reproduced from their versioned evidence.
- Friend-room membership or host authority can be forged.
- Saved-XI opponent selection can be controlled by the browser.
- Public content or share assets lack the required rights approval.
- Critical player flows lack visible error/recovery behavior.
- Migration or rollback procedures have not been rehearsed.
- Device ID production risk has no approved policy.

## Exit checklist

- [ ] All Phase 0–5 exit checklists are complete.
- [ ] Release configuration and secrets are reviewed.
- [ ] Migrations, backup, restore, reconciliation, and rollback are rehearsed.
- [ ] Security, abuse, and secret-scan checks pass.
- [ ] Integrated journeys pass on the approved browser/device matrix.
- [ ] Accessibility and performance budgets are met or explicitly accepted.
- [ ] Content and legal release gates are signed off.
- [ ] Operational signals and runbooks are ready.
- [ ] Production Device ID policy is approved.
- [ ] Staging release candidate receives explicit go approval.

**Exit criterion:** the production release candidate passes the complete player
journey, service evidence, security, recovery, accessibility, performance,
content, and operational gates with no unresolved go/no-go blocker.
