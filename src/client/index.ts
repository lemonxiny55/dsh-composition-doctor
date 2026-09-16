import { createReportView } from './report-view.js'

export const name = 'dsh-composition-doctor'

export interface SlotsContext {
  slots: {
    inject(name: 'settings.plugins.tab', factory: () => void | (() => void)): void | (() => void)
    register(metadata: SettingsSectionMetadata, component: () => unknown): void | (() => void)
  }
}

export interface SettingsSectionMetadata {
  name: 'settings.plugins.tab'
  id: string
  order: number
  label: () => string
}

export interface ClientRegistration {
  id: string
  actions: readonly ['export-json', 'export-markdown']
  component: () => unknown
}

export const registration: ClientRegistration = Object.freeze({
  id: name,
  actions: ['export-json', 'export-markdown'] as const,
  component: () => createReportView()
})

export interface ClientApply {
  (ctx: SlotsContext): void | (() => void)
  inject: readonly ['slots']
}

export const apply: ClientApply = Object.assign(
  (ctx: SlotsContext): void | (() => void) => ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: registration.id,
    order: 70,
    label: () => 'Composition Doctor'
  }, registration.component)),
  { inject: ['slots'] as const }
)

/** Stable, test-friendly metadata for the Web Settings contract. */
export function clientRegistration(): ClientRegistration {
  return registration
}

export default apply
