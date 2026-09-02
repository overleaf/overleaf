/**
 * Serve each built asset from a prepared response, reused until it is rebuilt.
 *
 * webpack-dev-middleware redoes the same work on every request: it looks the
 * file up in the in-memory filesystem, reads it, and hashes the whole body to
 * produce a strong ETag. Most of that output does not change between builds, so
 * it is recomputed for an answer already known - and under CI ~30 browsers
 * request the same chunks over and over.
 *
 * Only what the compilation emitted is served from here, taken from its own
 * asset list rather than an extension allowlist: a build emits .js and .css but
 * also .bcmap, .dic, .aff, .pfb and .woff2, and anything else reaching this
 * middleware belongs to somebody else.
 *
 * Two things a build does that this has to respect:
 *
 * - It reports `done` more than once - once for the compilation and once for the
 *   assets-manifest plugin's own compilation, which has two assets in it - and
 *   an incremental `done` reports only the assets it rewrote, 16 rather than 630.
 *   So asset names only ever accumulate, and the gate on a running build is a
 *   counter rather than a flag, which the manifest's `done` would reopen while
 *   the compilation it belongs to is still running.
 * - While a rebuild is running, webpack-dev-middleware holds requests until it
 *   finishes. This sits in front of it, so it steps aside for that window and
 *   drops the cache when a rebuild starts. Whether a response can be kept is
 *   decided when it ends rather than when it began: an epoch, bumped on every
 *   `invalid`, names the build its bytes were read from, and only a response
 *   from the current build with no rebuild in flight is stored. Nothing a
 *   rebuild has invalidated can land behind it, so every entry in the cache
 *   belongs to the build that is current and none has to be evicted by name.
 */
module.exports = function serveBuiltAssets(devServer) {
  const cache = new Map()
  const known = new Set()
  const compiler = devServer.compiler
  let building = 0
  let epoch = 0

  compiler.hooks.invalid.tap('serve-built-assets', () => {
    building++
    epoch++
    cache.clear()
  })

  compiler.hooks.done.tap('serve-built-assets', stats => {
    building = Math.max(0, building - 1)
    for (const asset of stats.toJson({ all: false, assets: true }).assets) {
      if (asset.name) known.add('/' + asset.name)
    }
  })

  return function serveBuiltAsset(req, res, next) {
    if (building > 0) return next()
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    // Ranges are served from the file itself; this only deals in whole bodies.
    if (req.headers.range) return next()

    const url = req.url.split('?')[0]
    if (!known.has(url)) return next()

    const hit = cache.get(url)
    if (hit) {
      if (req.headers['if-none-match'] === hit.headers.etag) {
        res.statusCode = 304
        return res.end()
      }
      for (const [name, value] of Object.entries(hit.headers)) {
        res.setHeader(name, value)
      }
      res.statusCode = 200
      return req.method === 'HEAD' ? res.end() : res.end(hit.body)
    }

    // Miss: let webpack-dev-middleware answer, and keep what it produced.
    const readEpoch = epoch
    const chunks = []
    const write = res.write.bind(res)
    const end = res.end.bind(res)
    res.write = (chunk, ...rest) => {
      if (chunk) chunks.push(Buffer.from(chunk))
      return write(chunk, ...rest)
    }
    res.end = (chunk, ...rest) => {
      if (chunk && typeof chunk !== 'function') chunks.push(Buffer.from(chunk))
      const headers = res.getHeaders()
      // Kept only while the build these bytes came from is the current one: a rebuild starting mid-response leaves them one behind.
      const current = building === 0 && epoch === readEpoch
      if (current && res.statusCode === 200 && headers.etag && chunks.length) {
        cache.set(url, { body: Buffer.concat(chunks), headers })
      }
      return end(chunk, ...rest)
    }
    next()
  }
}
