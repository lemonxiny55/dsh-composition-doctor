const args = process.argv.slice(2)
if (!args.includes('--dump-config')) process.exit(2)
process.stdout.write(JSON.stringify({ rows: [
  { id: 'bundle-row', name: 'Resolved bundle row', layer: 'bundle', layerOrder: 0, config: { enabled: true } },
  { id: 'bundle-row', name: 'Resolved profile override', layer: 'profile', layerOrder: 1, replacement: true, config: { enabled: true, mode: 'profile' } }
] }))
process.stderr.write('unmatched patch target: stale-row\n')
