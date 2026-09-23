import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

describe('published CLI entrypoint', () => {
  it('runs when the launcher supplies a non-canonical Windows-style path', async () => {
    const entrypoint = `${resolve('dist/cli')}${sep}..${sep}cli${sep}main.js`
    const version = await execFileAsync(process.execPath, [entrypoint, '--version'], {
      cwd: resolve('.'),
      windowsHide: true
    })
    expect(version.stdout.trim()).toBe('0.3.0')

    const help = await execFileAsync(process.execPath, [entrypoint, '--help'], {
      cwd: resolve('.'),
      windowsHide: true
    })
    expect(help.stdout.trim()).toBe('Usage: dsh-doctor <scan | snapshot | diff | preflight | why | impact>')
  })
})
