# Real DSH compatibility fixtures

The current harness targets official DSH `0.2.0-rc.2` through
`DSH_DOCTOR_REAL_DSH_CURRENT_BIN`. Historical `0.1.5-rc.1` and `0.1.5-rc.2`
remain available through `DSH_DOCTOR_REAL_DSH_RC1_BIN` and
`DSH_DOCTOR_REAL_DSH_RC2_BIN`. The test itself never downloads or installs DSH;
CI supplies the exact current artifact on Node 24, with scripts disabled.

When that artifact is available, run the compatibility test with the official
binary and review its output before adding a redacted golden fixture. Golden
files must contain only structural output: row ids, layer/order, replacement
flags, config key names, and sanitized provenance. They must not contain
tokens, environment values, workspace text, or runtime values.

In an environment without the artifact, the real-release test is explicitly
`SKIP/unavailable`; that state is not a compatibility PASS and no golden file
is created.
