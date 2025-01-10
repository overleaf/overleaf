import AbstractMockApi from './AbstractMockApi.mjs'
import { EventEmitter } from 'node:events'
import {
  zipAttachment,
  prepareZipAttachment,
} from '../../../../app/src/infrastructure/Response.js'
import Joi from 'joi'

class MockV1HistoryApi extends AbstractMockApi {
  reset() {
    this.fakeZipCall = 0
    this.requestedZipPacks = 0
    this.sentChunks = 0
    this.events = new EventEmitter()
    this.blobs = {}
  }

  applyRoutes() {
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
      const schema = Joi.object({
        copyFrom: Joi.number().required(),
      })
      const { error } = schema.validate(req.query)
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
