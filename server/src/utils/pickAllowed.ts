// Mass-assignment guard. Mongoose strict mode drops *unknown* fields, but
// it still happily writes anything on the schema — including fields the
// server populates itself (embedding, embeddingHash, timestamps). This
// helper strips a body down to the explicit whitelist before it reaches
// the model.
export function pickAllowed<T extends Record<string, unknown>>(
  body: unknown,
  allowed: readonly string[]
): Partial<T> {
  if (!body || typeof body !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = (body as Record<string, unknown>)[key]
    }
  }
  return out as Partial<T>
}
