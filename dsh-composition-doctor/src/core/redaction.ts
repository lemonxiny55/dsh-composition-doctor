const secretProperty = /key|token|secret|password|credential|authorization/i

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
