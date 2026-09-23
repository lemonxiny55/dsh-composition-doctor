if (!process.argv.includes('--dump-config')) process.exit(2)
process.stdout.write(`# == profile-layer, patched by @fixture/healthy-bundle\n- id: shared-row\n  name: Shared row\n  layer: profile\n  layerOrder: 2\n  config:\n    enabled: true\n    mode: profile\n`)
