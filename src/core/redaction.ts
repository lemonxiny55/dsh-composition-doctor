import { visit, parseDocument, Scalar } from 'yaml'
import type { Pair } from 'yaml'

const secretProperty = /key|token|secret|password|credential|authorization|cookie|private|passphrase|session|env/i

export function redact(value: unknown): unknown {
  const seen = new WeakMap<object, unknown>()

  const visit = (current: unknown): unknown => {
    if (current === null || typeof current !== 'object') return current
    const existing = seen.get(current)
    if (existing !== undefined) return existing

    if (Array.isArray(current)) {
      const copy: unknown[] = []
      seen.set(current, copy)
      for (const item of current) copy.push(visit(item))
      return copy
    }

    const copy: Record<string, unknown> = {}
    seen.set(current, copy)
    for (const property of Object.keys(current)) {
      copy[property] = secretProperty.test(property) ? '[REDACTED]' : visit((current as Record<string, unknown>)[property])
    }
    return copy
  }

  return visit(value)
}

/**
 * Redact YAML through its AST.  In particular, this preserves custom tags
 * such as !!js instead of round-tripping through a plain JavaScript value.
 * Tagged values are never executed.
 */
export function redactYamlPreservingTags(text: string): string {
  const document = parseDocument(text, { keepSourceTokens: true })
  visit(document, {
    Pair: (_key, pair: Pair) => {
      const key = pair.key instanceof Scalar ? String(pair.key.value) : String(pair.key ?? '')
      if (!secretProperty.test(key)) return
      if (pair.value instanceof Scalar) {
        pair.value.value = '[REDACTED]'
      } else {
        // A secret collection is replaced as a scalar; no value is evaluated,
        // and an unsupported collection shape is not silently copied.
        pair.value = document.createNode('[REDACTED]')
      }
    }
  })
  if (document.errors.length > 0) throw document.errors[0]
  return String(document)
}
