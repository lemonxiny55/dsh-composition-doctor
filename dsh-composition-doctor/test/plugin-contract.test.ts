import { describe, expect, test, vi } from 'vitest'

import { apply as applyHost, latestReportPath } from '../src/plugin/index.js'
import { apply as applyClient, clientRegistration } from '../src/client/index.js'

describe('host plugin contract', () => {
  test('registers only the read-only latest-report endpoint in an effect', async () => {
    const routes: Array<{ method: string; path: string; handler: Function }> = []
    const dispose = vi.fn()
    const ctx = {
      webServer: { register: (route: { method: string; path: string; handler: Function }) => { routes.push(route); return dispose } },
      effect: (effect: () => void | (() => void)) => effect()
    }
    applyHost(ctx)
    expect(routes).toEqual([expect.objectContaining({ method: 'GET', path: latestReportPath })])
    expect(routes[0]?.handler).toBeTypeOf('function')
    expect(routes[0]?.path).not.toContain('repair')
  })

  test('rejects non-GET requests without invoking a write', async () => {
    const route = await new Promise<{ handler: Function }>((resolve) => {
      applyHost({ webServer: { register: (value) => { resolve(value); return undefined } } })
    })
    const response = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() }
    await route.handler({ method: 'POST' }, response)
    expect(response.statusCode).toBe(405)
    expect(response.end).toHaveBeenCalledWith('{"error":"method_not_allowed"}\n')
  })
})

describe('client plugin contract', () => {
  test('registers the read-only settings section and export actions', () => {
    expect(clientRegistration().id).toBe('dsh-composition-doctor')
    expect(clientRegistration().actions).toEqual(['export-json', 'export-markdown'])
    expect(JSON.stringify(clientRegistration())).not.toMatch(/repair|save|write|install|uninstall/i)
  })

  test('uses public settings.plugins.tab slot and declares slots injection', () => {
    const registrations: unknown[] = []
    const ctx = {
      slots: {
        inject: (slot: 'settings.section', factory: () => void | (() => void)) => factory(),
        register: (metadata: unknown, component: () => unknown) => { registrations.push({ metadata, component }); return undefined }
      }
    }
    applyClient(ctx)
    expect(applyClient.inject).toEqual(['slots', 'locale'])
    expect(registrations).toHaveLength(1)
    expect(registrations[0]).toEqual(expect.objectContaining({ metadata: expect.objectContaining({ name: 'settings.plugins.tab', id: 'dsh-composition-doctor' }) }))
  })
})
