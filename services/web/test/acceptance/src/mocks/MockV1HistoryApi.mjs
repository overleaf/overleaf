import AbstractMockApi from './AbstractMockApi.mjs'
import { EventEmitter } from 'node:events'
import {
  zipAttachment,
  prepareZipAttachment,
} from '../../../../app/src/infrastructure/Response.mjs'
import { z } from 'zod'

class MockV1HistoryApi extends AbstractMockApi {
  reset() {
    this.fakeZipCall = 0
    this.requestedZipPacks = 0
    this.sentChunks = 0
    this.events = new EventEmitter()
    this.blobs = {}
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
      res.json(
        // Calculate actual sizes from uploaded blobs
        req.body.projectIds.map(projectId => {
          return this.computeBlobStats(projectId)
        })
      )
    })

    this.app.post('/api/projects/:historyId/blob-stats', (req, res, next) => {
      const { historyId } = req.params
      const { blobHashes } = req.body
      // Calculate actual sizes from uploaded blobs
      const result = this.computeBlobStats(historyId, blobHashes)
      res.json(result)
    })

    this.app.get(
      '/api/projects/:project_id/version/:version/zip',
      (req, res, next) => {
        this.sentChunks++
        zipAttachment(
          res,
          `Mock zip for ${req.params.project_id} at version ${req.params.version}`,
          'project.zip'
        )
      }
    )

    this.app.get(
      '/fake-zip-download/:project_id/version/:version',
      (req, res, next) => {
        if (!(this.fakeZipCall++ > 0)) {
          return res.sendStatus(404)
        }
        if (req.params.version === '42') {
          return zipAttachment(
            res,
            `Mock zip for ${req.params.project_id} at version ${req.params.version}`,
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
        if (req.params.version === '100') {
          return writeEvery(100)
        }
        res.sendStatus(400)
      }
    )

    this.app.post(
      '/api/projects/:project_id/version/:version/zip',
      (req, res, next) => {
        this.requestedZipPacks++
        this.events.emit('v1-history-pack-zip')
        res.json({
          zipUrl: `http://127.0.0.1:23100/fake-zip-download/${req.params.project_id}/version/${req.params.version}`,
        })
      }
    )

    this.app.delete('/api/projects/:project_id', (req, res, next) => {
      res.sendStatus(204)
    })

    this.app.put('/api/projects/:projectId/blobs/:hash', (req, res, next) => {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        const { projectId, hash } = req.params
        if (!this.blobs[projectId]) {
          this.blobs[projectId] = {}
        }
        this.blobs[projectId][hash] = Buffer.concat(chunks)
        res.sendStatus(200)
      })
    })
    this.app.head('/api/projects/:projectId/blobs/:hash', (req, res, next) => {
      const { projectId, hash } = req.params
      const buf = this.blobs[projectId]?.[hash]
      if (!buf) return res.status(404).end()
      res.set('Content-Length', buf.byteLength)
      res.status(200).end()
    })
    this.app.get('/api/projects/:projectId/blobs/:hash', (req, res, next) => {
      const { projectId, hash } = req.params
      const buf = this.blobs[projectId]?.[hash]
      if (!buf) return res.status(404).end()
      res.status(200).end(buf)
    })

    this.app.post('/api/projects/:project_id/blobs/:hash', (req, res, next) => {
      const schema = z.object({
        copyFrom: z.coerce.number(),
      })
      const { error } = schema.safeParse(req.query)
      if (error) {
        return res.sendStatus(400)
      }
      res.sendStatus(204)
    })
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
