import AbstractMockApi from './AbstractMockApi.mjs'
import { EventEmitter } from 'node:events'
import {
  zipAttachment,
  prepareZipAttachment,
} from '../../../../app/src/infrastructure/Response.mjs'
import { Blob } from 'overleaf-editor-core'
import { parseReq, z, zz } from '@overleaf/validation-tools'

// Mirrors services/history-v1/api/schema.js (the canonical template for this
// whole epic) for routes that correspond to a real history-v1 endpoint.
// Routes that only exist as internal mock plumbing (fake-zip-download,
// manufactured by this mock's own createZip handler, not a real history-v1
// route) get their own narrow schema instead.

const hexHashPattern = new RegExp(Blob.HEX_HASH_RX_STRING)

// matches history-v1's getProjectBlobsStats
const blobStatsSchema = z.object({
  body: z.strictObject({
    projectIds: z.array(zz.projectHistoryId()),
  }),
})

// matches history-v1's getBlobStats -- this mock binds the project id param
// as `historyId` rather than `project_id`.
const projectBlobStatsSchema = z.object({
  params: z.strictObject({ historyId: zz.projectHistoryId() }),
  body: z.strictObject({ blobHashes: z.array(z.string()) }),
})

// matches history-v1's getZip/createZip
const versionZipParamsSchema = z.object({
  params: z.strictObject({
    project_id: zz.projectHistoryId(),
    version: z.coerce.number(),
  }),
})

// Not a real history-v1 route -- this is the URL this mock's own createZip
// handler manufactures for the client to poll/download from. `version` is
// compared against literal strings below, so it stays an un-coerced string
// here rather than mirroring versionZipParamsSchema's z.coerce.number().
const fakeZipDownloadParamsSchema = z.object({
  params: z.strictObject({
    project_id: zz.projectHistoryId(),
    version: z.string(),
  }),
})

// matches history-v1's createProjectBlob/headProjectBlob/getProjectBlob
const blobParamsSchema = z.object({
  params: z.strictObject({
    projectId: zz.projectHistoryId(),
    hash: z.string().regex(hexHashPattern),
  }),
})

// matches history-v1's getLatestHistory
const latestHistoryParamsSchema = z.object({
  params: z.strictObject({ project_id: zz.projectHistoryId() }),
})

// matches history-v1's copyProjectBlob query (params aren't read by this
// mock's handler, so they're left out of the schema)
const copyProjectBlobSchema = z.object({
  query: z.object({
    copyFrom: zz.projectHistoryId(),
    sizeLimit: z.coerce.number().optional(),
  }),
})

class MockV1HistoryApi extends AbstractMockApi {
  reset() {
    this.fakeZipCall = 0
    this.requestedZipPacks = 0
    this.sentChunks = 0
    this.events = new EventEmitter()
    this.blobs = {}
    // when true, /latest/history 404s, so compile-from-history requests cannot
    // be composed and web falls back to building them from mongo
    this.latestHistoryUnavailable = false
    this.chunks = {}
  }

  addBlob(historyId, hash, content) {
    if (!this.blobs[historyId]) {
      this.blobs[historyId] = {}
    }
    this.blobs[historyId][hash] = Buffer.from(content)
  }

  addChunk(historyId, chunk) {
    this.chunks[historyId] = chunk
  }

  computeBlobStats(historyId, blobHashes) {
    let textBlobBytes = 0
    let binaryBlobBytes = 0
    let nTextBlobs = 0
    let nBinaryBlobs = 0
    if (!blobHashes) {
      blobHashes = this.blobs[historyId]
        ? Object.keys(this.blobs[historyId])
        : []
    }
    for (const hash of blobHashes) {
      const buf = this.blobs[historyId][hash]
      if (buf) {
        const size = buf.byteLength

        // Check if the blob content is valid UTF-8
        let isText = false
        try {
          const decoder = new TextDecoder('utf-8', { fatal: true })
          decoder.decode(buf)
          isText = true
        } catch (e) {
          // Not valid UTF-8, treat as binary
          isText = false
        }

        if (isText) {
          textBlobBytes += size
          nTextBlobs++
        } else {
          binaryBlobBytes += size
          nBinaryBlobs++
        }
      }
    }

    const totalBytes = textBlobBytes + binaryBlobBytes

    return {
      projectId: historyId,
      textBlobBytes,
      binaryBlobBytes,
      totalBytes,
      nTextBlobs,
      nBinaryBlobs,
    }
  }

  applyRoutes() {
    this.app.post('/api/projects/blob-stats', (req, res, next) => {
      const { body } = parseReq(req, blobStatsSchema)
      res.json(
        // Calculate actual sizes from uploaded blobs
        body.projectIds.map(projectId => {
          return this.computeBlobStats(projectId)
        })
      )
    })

    this.app.post('/api/projects/:historyId/blob-stats', (req, res, next) => {
      const { params, body } = parseReq(req, projectBlobStatsSchema)
      const { historyId } = params
      const { blobHashes } = body
      // Calculate actual sizes from uploaded blobs
      const result = this.computeBlobStats(historyId, blobHashes)
      res.json(result)
    })

    this.app.get(
      '/api/projects/:project_id/version/:version/zip',
      (req, res, next) => {
        const { params } = parseReq(req, versionZipParamsSchema)
        this.sentChunks++
        zipAttachment(
          res,
          `Mock zip for ${params.project_id} at version ${params.version}`,
          'project.zip'
        )
      }
    )

    this.app.get(
      '/fake-zip-download/:project_id/version/:version',
      (req, res, next) => {
        const { params } = parseReq(req, fakeZipDownloadParamsSchema)
        if (!(this.fakeZipCall++ > 0)) {
          return res.sendStatus(404)
        }
        if (params.version === '42') {
          return zipAttachment(
            res,
            `Mock zip for ${params.project_id} at version ${params.version}`,
            'project.zip'
          )
        }
        prepareZipAttachment(res, 'project.zip')
        const writeChunk = () => {
          res.write('chunk' + this.sentChunks++)
        }
        const writeEvery = interval => {
          if (req.destroyed) return

          // setInterval delays the first run
          writeChunk()
          const periodicWrite = setInterval(writeChunk, interval)
          req.on('close', () => clearInterval(periodicWrite))

          const deadLine = setTimeout(() => {
            clearInterval(periodicWrite)
            res.end()
          }, 10 * 1000)
          res.on('end', () => clearTimeout(deadLine))
        }
        if (params.version === '100') {
          return writeEvery(100)
        }
        res.sendStatus(400)
      }
    )

    this.app.post(
      '/api/projects/:project_id/version/:version/zip',
      (req, res, next) => {
        const { params } = parseReq(req, versionZipParamsSchema)
        this.requestedZipPacks++
        this.events.emit('v1-history-pack-zip')
        res.json({
          zipUrl: `http://127.0.0.1:23100/fake-zip-download/${params.project_id}/version/${params.version}`,
        })
      }
    )

    this.app.delete('/api/projects/:project_id', (req, res, next) => {
      res.sendStatus(204)
    })

    this.app.put('/api/projects/:projectId/blobs/:hash', (req, res, next) => {
      const { params } = parseReq(req, blobParamsSchema)
      const { projectId, hash } = params
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        if (!this.blobs[projectId]) {
          this.blobs[projectId] = {}
        }
        this.blobs[projectId][hash] = Buffer.concat(chunks)
        res.sendStatus(200)
      })
    })
    this.app.head('/api/projects/:projectId/blobs/:hash', (req, res, next) => {
      const { params } = parseReq(req, blobParamsSchema)
      const { projectId, hash } = params
      const buf = this.blobs[projectId]?.[hash]
      if (!buf) return res.status(404).end()
      res.set('Content-Length', buf.byteLength)
      res.status(200).end()
    })
    this.app.get('/api/projects/:projectId/blobs/:hash', (req, res, next) => {
      const { params } = parseReq(req, blobParamsSchema)
      const { projectId, hash } = params
      const buf = this.blobs[projectId]?.[hash]
      if (!buf) return res.status(404).end()
      res.status(200).end(buf)
    })

    this.app.post('/api/projects/:project_id/blobs/:hash', (req, res, next) => {
      parseReq(req, copyProjectBlobSchema)
      res.sendStatus(204)
    })

    this.app.get(
      '/api/projects/:project_id/latest/history',
      (req, res, next) => {
        const { params } = parseReq(req, latestHistoryParamsSchema)
        if (this.latestHistoryUnavailable) {
          return res.sendStatus(404)
        }
        const chunk = this.chunks[params.project_id] || {
          history: { snapshot: { files: {} }, changes: [] },
          startVersion: 0,
        }
        res.json({ chunk })
      }
    )
  }
}

export default MockV1HistoryApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockV1HistoryApi
 * @static
 * @returns {MockV1HistoryApi}
 */
