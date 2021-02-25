const AbstractMockApi = require('./AbstractMockApi')
const { EventEmitter } = require('events')

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
        res.header('content-disposition', 'attachment; name=project.zip')
        res.header('content-type', 'application/octet-stream')
        res.send(
          `Mock zip for ${req.params.project_id} at version ${req.params.version}`
        )
      }
    )

    this.app.get(
      '/fake-zip-download/:project_id/version/:version',
      (req, res, next) => {
        if (!(this.fakeZipCall++ > 0)) {
          return res.sendStatus(404)
        }
        res.header('content-disposition', 'attachment; name=project.zip')
        res.header('content-type', 'application/octet-stream')
        if (req.params.version === '42') {
          return res.send(
            `Mock zip for ${req.params.project_id} at version ${req.params.version}`
          )
        }
        const writeChunk = () => {
          res.write('chunk' + this.sentChunks++)
        }
        const writeEvery = interval => {
          if (req.aborted) return

          // setInterval delays the first run
          writeChunk()
          const periodicWrite = setInterval(writeChunk, interval)
          req.on('aborted', () => clearInterval(periodicWrite))

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
          zipUrl: `http://localhost:3100/fake-zip-download/${req.params.project_id}/version/${req.params.version}`
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
