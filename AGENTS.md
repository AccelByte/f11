# Football 11 repository instructions

## Progress tracking

For every task that changes project state, including implementation, design,
documentation, research, configuration, and verification work:

1. Update `docs/10-progress-tracker.md` in the same change.
2. Update the relevant tracker item status, evidence, next action, and tracker
   date.
3. Mark an item `Done` only when its evidence exists and its acceptance check
   passes. Do not use subjective percentage estimates.
4. Add a new stable item ID before starting work that is not represented.
5. Never hide a blocker: use `Needs decision` for a user/product choice and
   describe whether it blocks the Functional MVP or only a later release.

## Public documentation

Keep documentation reader-facing and grounded in repository evidence. Distinguish
implemented and verified behavior from planned, deferred, or blocked work. Never
include secrets, credentials, private endpoints, personal data, or confidential
configuration.
