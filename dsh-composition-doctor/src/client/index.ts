import { createReportView } from './report-view.js'

export const name = 'dsh-composition-doctor'

export interface SlotsContext {
  locale?: {
    register(namespace: string, messages: { zh: Record<string, string>; en: Record<string, string> }): void | (() => void)
    bind(namespace: string): (key: string) => string
  }
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
  locale?: string
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
  inject: readonly ['slots', 'locale']
}

export const apply: ClientApply = Object.assign(
  (ctx: SlotsContext): void | (() => void) => {
    const messages = {
      zh: { title: 'DSH 组合医生', exportJson: '导出 JSON', exportMarkdown: '导出 Markdown' },
      en: { title: 'DSH Composition Doctor', exportJson: 'Export JSON', exportMarkdown: 'Export Markdown' }
    }
    const disposeLocale = ctx.locale?.register('dshCompositionDoctor', messages)
    const t = ctx.locale?.bind('dshCompositionDoctor') ?? ((key: string) => messages.en[key as keyof typeof messages.en] ?? key)
    const disposeSlot = ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
      name: 'settings.plugins.tab', id: registration.id, order: 70,
      locale: 'dshCompositionDoctor', label: () => t('title')
    }, () => createReportView(undefined, t)))
    return () => {
      if (typeof disposeSlot === 'function') disposeSlot()
      if (typeof disposeLocale === 'function') disposeLocale()
    }
  },
  { inject: ['slots', 'locale'] as const }
)

/** Stable, test-friendly metadata for the Web Settings contract. */
export function clientRegistration(): ClientRegistration {
  return registration
}

export default apply
