import { describe, expect, test, vi } from 'vitest'

vi.mock('react', () => ({
  createElement: (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => ({ type, props, children }),
  useEffect: () => undefined,
  useRef: <T>(initial: T) => ({ current: initial })
}))

import type { AnalysisReport } from '../src/core/types.js'
import { download, downloadRevokeDelayMs, exportReport } from '../src/client/report-view.js'

const report: AnalysisReport = {
  schemaVersion: 1,
  generatedAt: '2026-09-16T00:00:00.000Z',
  profileDir: 'C:/safe/profile',
  evidenceMode: 'static',
  unverifiedFindings: [],
  diagnostics: [{
    id: 'fixture', severity: 'warning', title: 'Fixture warning', explanation: 'Why this matters.',
    evidence: [{ source: 'package.json', detail: 'Fixture evidence.' }], remediation: 'Fix the fixture.'
  }]
}

function successfulFetch(): typeof fetch {
  return vi.fn(async () => ({ ok: true, json: async () => report })) as unknown as typeof fetch
}

describe('report downloads', () => {
  test('creates a temporary link and delays Blob URL revocation until after the click', async () => {
    const link = { hidden: false, href: '', download: '', click: vi.fn(), remove: vi.fn() }
    const append = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:report')
    const revokeObjectURL = vi.fn()
    const schedule = vi.fn()
    const document = { body: { append }, createElement: vi.fn(() => link) } as unknown as Document

    download(document, '{"schemaVersion":1}\n', 'dsh-composition-doctor-report.json', 'application/json', { createObjectURL, revokeObjectURL, schedule })

    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('application/json')
    await expect(blob.text()).resolves.toBe('{"schemaVersion":1}\n')
    expect(link).toMatchObject({ hidden: true, href: 'blob:report', download: 'dsh-composition-doctor-report.json' })
    expect(append).toHaveBeenCalledWith(link)
    expect(link.click).toHaveBeenCalledOnce()
    expect(link.remove).toHaveBeenCalledOnce()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), downloadRevokeDelayMs)
    schedule.mock.calls[0]?.[0]()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report')
  })

  test('exports valid JSON and Markdown with the expected names and MIME types', async () => {
    const downloadSpy = vi.fn()
    const dependencies = { fetcher: successfulFetch(), download: downloadSpy }
    await exportReport({} as Document, 'json', dependencies)
    const [jsonDocument, json, jsonName, jsonMime] = downloadSpy.mock.calls[0]!
    expect(jsonDocument).toEqual({})
    expect(jsonName).toBe('dsh-composition-doctor-report.json')
    expect(jsonMime).toBe('application/json')
    expect(JSON.parse(json)).toMatchObject({ schemaVersion: 1, diagnostics: [{ id: 'fixture' }] })

    await exportReport({} as Document, 'markdown', dependencies)
    const [, markdown, markdownName, markdownMime] = downloadSpy.mock.calls[1]!
    expect(markdownName).toBe('dsh-composition-doctor-report.md')
    expect(markdownMime).toBe('text/markdown')
    expect(markdown).toContain('# DSH Composition Doctor Report')
    expect(markdown).toContain('Summary:')
    expect(markdown).toContain('Fixture warning')
    expect(markdown).toContain('Fixture evidence.')
    expect(markdown).toContain('Remediation: Fix the fixture.')
  })

  test.each([
    ['failed fetch', vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch],
    ['malformed report', vi.fn(async () => ({ ok: true, json: async () => ({ schemaVersion: 2, diagnostics: [] }) })) as unknown as typeof fetch]
  ])('does not trigger a download for %s', async (_label, fetcher) => {
    const downloadSpy = vi.fn()
    await expect(exportReport({} as Document, 'json', { fetcher, download: downloadSpy })).rejects.toThrow()
    expect(downloadSpy).not.toHaveBeenCalled()
  })
})
