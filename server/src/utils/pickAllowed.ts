// Mass-assignment guard. Mongoose strict mode drops *unknown* fields, but
// it still happily writes anything on the schema — including fields the
// server populates itself (embedding, embeddingHash, timestamps). This
// helper strips a body down to the explicit whitelist before it reaches
// the model, and throws a 400-tagged error if the body carries any other
// keys so silent drift is caught loudly.

// Round-trip fields the client routinely echoes back (e.g. when PUTting a
// full document it just read). They're harmless to receive and aren't
// attacks, so they don't trigger a reject.
const ALWAYS_IGNORED = new Set(['_id', '__v', 'createdAt', 'updatedAt'])

export class InvalidFieldsError extends Error {
  readonly status = 400
  constructor(public readonly fields: readonly string[]) {
    super(`Unexpected fields: ${fields.join(', ')}`)
    this.name = 'InvalidFieldsError'
  }
}

export function pickAllowed<T extends Record<string, unknown>>(
  body: unknown,
  allowed: readonly string[]
): Partial<T> {
  if (!body || typeof body !== 'object') return {}
  const allowedSet = new Set(allowed)
  const unknown: string[] = []
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (allowedSet.has(key)) {
      out[key] = (body as Record<string, unknown>)[key]
    } else if (!ALWAYS_IGNORED.has(key)) {
      unknown.push(key)
    }
  }
  if (unknown.length) throw new InvalidFieldsError(unknown)
  return out as Partial<T>
}
