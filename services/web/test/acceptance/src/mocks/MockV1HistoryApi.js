const AbstractMockApi = require('./AbstractMockApi')
const { EventEmitter } = require('events')
const {
  zipAttachment,
  prepareZipAttachment,
} = require('../../../../app/src/infrastructure/Response')

class MockV1HistoryApi extends AbstractMockApi {
  reset() {
    this.fakeZipCall = 0
    this.requestedZipPacks = 0
    this.sentChunks = 0
    this.events = new EventEmitter()
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
  }
}

module.exports = MockV1HistoryApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockV1HistoryApi
 * @static
 * @returns {MockV1HistoryApi}
 */
