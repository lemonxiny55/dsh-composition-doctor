# Real DSH compatibility fixtures

The harness targets official DSH releases `0.1.5-rc.1` and `0.1.5-rc.2` via
`DSH_DOCTOR_REAL_DSH_RC1_BIN` and `DSH_DOCTOR_REAL_DSH_RC2_BIN`. It never
downloads or installs DSH.

When that artifact is available, run the compatibility test with the official
binary and review its output before adding a redacted golden fixture. Golden
files must contain only structural output: row ids, layer/order, replacement
flags, config key names, and sanitized provenance. They must not contain
tokens, environment values, workspace text, or runtime values.

In an environment without the artifact, the real-release test is explicitly
`SKIP/unavailable`; that state is not a compatibility PASS and no golden file
is created.
