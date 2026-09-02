import AbstractMockApi from './AbstractMockApi.mjs'
import { parseReq, z, zz } from '@overleaf/validation-tools'

// Mirrors the shape of the real lookup paths ClsiCacheHandler builds (see
// getOutputFile/getLatestOutputFile in ClsiCacheHandler.mjs) -- validating
// them here (like MockV1HistoryApi's inline schema.safeParse) catches an
// app-side path-construction mistake as a 400 from this mock, rather than
// a confusing miss against `entries` that looks identical to "nothing
// cached yet" (a plain 404).
const lookupSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    user_id: zz.objectId().optional(),
    // matches clsi-cache's own getLastOutputFileParamsSchema /
    // getLatestOutputFileParamsSchema (HTTPController.js)
    editorBuildId: zz.editorBuildId().optional(),
    // matches clsi-cache's own filenameSchema (HTTPController.js)
    filename: zz.filepath(),
  }),
})

const contentSchema = z.object({
  params: z.strictObject({
    contentId: z.string().nonempty(),
  }),
})

/**
 * Stand-in for a clsi-cache instance (services/clsi-cache).
 *
 * ClsiCacheHandler's getOutputFile/getLatestOutputFile each make a "search"
 * or "latest" lookup request (redirect: 'manual') and expect either a 404
 * (nothing cached) or a 3xx redirect carrying X-Zone/X-Shard/
 * X-Last-Modified/X-Content-Length/X-All-Files headers and a Location the
 * caller then fetches separately for the actual bytes -- see
 * getRedirectWithFallback in ClsiCacheHandler.mjs. This mock reproduces both
 * legs: register a cache entry at the exact lookup path the app will
 * request (via `addEntry`), and this class serves the redirect plus the
 * content it points to.
 */
class MockClsiCache extends AbstractMockApi {
  reset() {
    this.entries = new Map() // lookup path -> { contentId, lastModified, zone, shard, allFiles }
    this.content = new Map() // contentId -> { content, contentType }
  }

  /**
   * @param {string} path - the exact request path ClsiCacheHandler will look
   *   up, e.g. `/project/ID/user/UID/build/BUILD/search/output/output.pdf`
   *   or `/project/ID/latest/output/output.overleaf.json`
   * @param {object} options
   * @param {string|Buffer} options.content
   * @param {string} [options.contentType]
   * @param {Date} [options.lastModified]
   * @param {string} [options.zone]
   * @param {string} [options.shard]
   * @param {string[]} [options.allFiles]
   */
  addEntry(
    path,
    {
      content,
      contentType = 'text/plain',
      lastModified = new Date(),
      zone = 'zone1',
      shard = 'shard1',
      allFiles,
    }
  ) {
    const contentId = `${this.content.size}`
    this.content.set(contentId, { content, contentType })
    this.entries.set(path, {
      contentId,
      lastModified,
      zone,
      shard,
      allFiles: allFiles || [path.split('/').pop()],
    })
  }

  _lookup(req, res) {
    parseReq(req, lookupSchema)
    const entry = this.entries.get(req.path)
    if (!entry) {
      return res.sendStatus(404)
    }
    const { content } = this.content.get(entry.contentId)
    res.set('X-Zone', entry.zone)
    res.set('X-Shard', entry.shard)
    res.set('X-Last-Modified', entry.lastModified.toISOString())
    res.set('X-Content-Length', String(Buffer.byteLength(content)))
    res.set('X-All-Files', JSON.stringify(entry.allFiles))
    res.redirect(302, `/content/${entry.contentId}`)
  }

  applyRoutes() {
    // getOutputFile's two routes (with/without the per-user segment)
    this.app.get(
      '/project/:project_id/user/:user_id/build/:editorBuildId/search/output/:filename',
      (req, res) => this._lookup(req, res)
    )
    this.app.get(
      '/project/:project_id/build/:editorBuildId/search/output/:filename',
      (req, res) => this._lookup(req, res)
    )
    // getLatestOutputFile's two routes (with/without the per-user segment)
    this.app.get(
      '/project/:project_id/user/:user_id/latest/output/:filename',
      (req, res) => this._lookup(req, res)
    )
    this.app.get('/project/:project_id/latest/output/:filename', (req, res) =>
      this._lookup(req, res)
    )

    this.app.get('/content/:contentId', (req, res) => {
      const { params } = parseReq(req, contentSchema)
      const entry = this.content.get(params.contentId)
      if (!entry) {
        return res.sendStatus(404)
      }
      res.set('Content-Type', entry.contentType)
      res.end(entry.content)
    })
  }
}

export default MockClsiCache

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockClsiCache
 * @static
 * @returns {MockClsiCache}
 */
