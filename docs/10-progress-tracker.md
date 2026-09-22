# Offline starter progress tracker

**Last updated:** September 22, 2026

This ledger describes the offline tutorial branch only. The
[connected reference ledger](connected-reference-progress.md) preserves earlier
project evidence and does not mean those online features are present here.

| ID | Item | Status | Evidence / next action |
| --- | --- | --- | --- |
| START-04 | Rebase starter onto the shared tutorial on master | Done | master commit cc7a425 contains the consolidated tutorial. The starter is rebased onto it and shares the identical guide; runtime files match the previous starter exactly. Relative documentation links, anchors, fences, and whitespace pass. Next: implement ONLINE-01 when ready; publication remains deferred. |
| START-03 | Consolidate the tutorial into one document | Done | docs/12-accelbyte-integration-guide.md contains offline setup, AGS onboarding, all six integration stages, and supporting service references. Removed 18 superseded documents and updated documentation links. All 110 relative links and section anchors pass; code fences are balanced and six stage anchors exist. Next: follow ONLINE-01 after its prerequisites pass. |
| START-01 | Credential-free offline mechanics baseline | Done | Fresh source-only copy installed with npm ci --offline --ignore-scripts and no environment file; typecheck, 58 tests, and production build pass there. Main checkout format checks pass; lint has existing warnings and no errors. Browser completed one reroll and eleven placements to a 63-point, 19/6/13 season. Source scan finds no runtime network calls and lockfile contains no AGS, Sites, or Worker packages. Next: implement Device ID only after tutorial prerequisites pass. |
| START-02 | Ordered integration tutorial | Done | README, the consolidated tutorial, and this branch-specific ledger distinguish future work from connected-project reference evidence. Link validation is recorded under START-03. Each stage has prerequisites, a prompt, exclusions, and acceptance checks. Next: follow ONLINE-01, then ONLINE-02; live service integration is intentionally not performed. |
| ONLINE-01 | Device ID guest login | Not started | Follow `docs/12-accelbyte-integration-guide.md#stage-1` after its prerequisites pass. |
| ONLINE-02 | Private Cloud Save | Not started | Follow `docs/12-accelbyte-integration-guide.md#stage-2` after its prerequisites pass. |
| ONLINE-03 | Trusted replay and ranking | Not started | Follow `docs/12-accelbyte-integration-guide.md#stage-3` after its prerequisites pass. |
| ONLINE-04 | Server-issued draft configuration | Not started | Follow `docs/12-accelbyte-integration-guide.md#stage-4` after its prerequisites pass. |
| ONLINE-05 | Friend rooms | Not started | Follow `docs/12-accelbyte-integration-guide.md#stage-5` after its prerequisites pass. |
| ONLINE-06 | Asynchronous Saved-XI competition | Not started | Follow `docs/12-accelbyte-integration-guide.md#stage-6` after its prerequisites pass. |
| START-05 | Apply public-source cleanup from master | Done | Rebased onto master cleanup; obsolete narrative documents and references are absent, and local deployment bindings remain ignored. Runtime source matches the previous starter. Relative documentation links and targeted credential/private-value scans pass. Next: implement ONLINE-01 when ready; publication remains deferred. |

| START-06 | Rename the tutorial branch | Done | Local branch is offline-starter; the shared tutorial and reference ledger use the new name. Rebased onto master documentation update. Next: follow ONLINE-01; remote publication remains deferred. |

| PUB-01 | Publish clean connected and offline source branches | Done | Published connected main as a single root commit and offline-starter as its direct child, with no development ancestry. Both trees match the prepared source; 176 connected files and 110 offline files pass credential/exclusion scans and 107 documentation-link checks each. Atomic push and remote readback passed; gh-pages is unchanged. Next: preserve this source-branch boundary for future updates. |

| DOC-13 | Restore agent-ready integration plans | Done | Six files under docs/ags-plans provide stage scope, prerequisites, execution checklists, original connected design details, acceptance checks, and direct handoff prompts. Tutorial and indexes link to the plans. All 137 relative documentation links pass; plan fences and credential/private-value checks pass. Historical notes are distinguished from unimplemented starter work. Next: give the Stage 1 plan to the implementing agent. |

| DOC-14 | Attribute registration links to the source-code campaign | Done | Both tutorial registration links use the supplied URL with all four UTM parameters. Exact URL checks, relative documentation links, and whitespace checks pass. Documentation-only; the game has no registration CTA. Next: preserve this campaign attribution in future registration links. |
