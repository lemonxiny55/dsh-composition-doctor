# DSH Composition Doctor — Failure Explanation

Profile: <PROFILE>; runtime: not-observed

## Bundle patch is unavailable: dsh-cad
reported-by-log; evidence: static

Cause: The declared bundle has missing, invalid or disallowed patch metadata. Its manifest declaration does not supply an observable loader contribution.

Path 1: bundle dsh-cad → <PROFILE>/node_modules/dsh-cad/package.json
  layer: unknown

Unknown: Runtime failure and plugin behavior: not observed / not-run. Final composition: unknown. Home/CLI overlays and installation-level bundles are not inspected by the default static reader.
Next: Review the bundle manifest → dsh.bundle.patch and packaged YAML file. Check the publisher tarball contents; do not substitute or execute a file suggested by the log.

Review the named source paths. If the cause is unknown, verify the profile selection and compare a public dump, why row, snapshot/diff or preflight.
Doctor did not modify your profile.
