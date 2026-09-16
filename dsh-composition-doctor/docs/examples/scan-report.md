# Example scan report / 扫描报告示例

```markdown
## warning — Runtime composition is unavailable

- evidence: `cordis.yml`, subject `runtime-composition-unavailable`, evidence kind `static`
- explanation: static YAML was read, but no public resolved-composition provider was supplied.
- remediation: provide a public provider in an isolated fixture and rerun.
```

This is an uncertainty warning, not a claim that startup will fail.
