import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const sourceEntry = './src/client/index.ts'

// DSH's browser module loader expects every client export to register itself.
// Keep this adapter isolated from the Node/CLI build so the public client
// entrypoint remains compatible with the developer-preview loader contract.
const result = await build({
  entryPoints: [sourceEntry],
  absWorkingDir: process.cwd(),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  write: false,
  legalComments: 'none'
})

const body = result.outputFiles[0]?.text
if (!body) throw new Error('client bundle was empty')

const output = `window.__ModuleLoader__.load({\n\tid: "dsh-composition-doctor",\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;\n${body.split('\n').map((line) => `\t\t${line}`).join('\n')}\n\t\treturn module.exports;\n\t}\n});\n`

const destination = join(projectRoot, '..', 'dist', 'client.js')
await mkdir(dirname(destination), { recursive: true })
await writeFile(destination, output, 'utf8')
