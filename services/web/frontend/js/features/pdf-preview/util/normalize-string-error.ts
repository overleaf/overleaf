/**
 * V8 can throw the bare string "out of memory" (instead of an Error) from
 * buffer-allocation paths such as `new Uint8Array(N)` and
 * `Response.prototype.arrayBuffer()`. Wrap such string errors in an Error so
 * that downstream consumers (e.g. OError.tag, Sentry) which assume an Error
 * object continue to work.
 *
 * Non-string values are returned unchanged, so genuine programming bugs that
 * `throw null`/`throw 42`/etc. still surface unmasked.
 */
export function normalizeStringError(err: unknown): unknown {
  return typeof err === 'string' ? new Error(err) : err
}
