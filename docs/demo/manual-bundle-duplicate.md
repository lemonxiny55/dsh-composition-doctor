# DSH Composition Doctor — Failure Explanation

Profile: <PROFILE>; runtime: not-observed

## Duplicate loader entry id: session-cleaner
reported-by-log; evidence: static

Cause: session-cleaner is introduced by 2 separate loader declarations. Both inserts use the same id; the final loader outcome is unknown until composition/runtime is observed.

Path 1: bundle session-cleaner → <PROFILE>/node_modules/session-cleaner/cordis.patch.yml
  layer: dsh.profile.bundles[0]: session-cleaner → row: session-cleaner
  provenance: introduced: session-cleaner (derived)
Path 2: cordis.patch.yml
  layer: cordis.patch.yml → row: session-cleaner
  provenance: introduced: cordis.patch.yml (derived)

Unknown: Runtime failure and plugin behavior: not observed / not-run. Final composition: unknown. Home/CLI overlays and installation-level bundles are not inspected by the default static reader.
Next: Review the listed bundle declarations and profile patch. Keep one intended insertion for this id after checking its config; use why row and impact bundle for details.

Review the named source paths. If the cause is unknown, verify the profile selection and compare a public dump, why row, snapshot/diff or preflight.
Doctor did not modify your profile.
