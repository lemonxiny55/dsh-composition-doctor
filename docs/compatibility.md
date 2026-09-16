# Compatibility / 兼容性

- DSH: `>=0.1.0-rc.5 <0.2.0` (developer preview)
- Cordis: `>=4 <5`
- Node.js: `>=20`
- Platforms: Windows first; macOS/Linux supported for filesystem and CLI paths.

The public DSH API does not yet expose a stable resolved-composition introspection contract. The adapter accepts an injected public provider; otherwise findings are static and explicitly labelled. Web registration uses the public `settings.plugins.tab` slot and a GET-only report route. Private loaders, monkey patches, and permission escalation are intentionally unsupported.
