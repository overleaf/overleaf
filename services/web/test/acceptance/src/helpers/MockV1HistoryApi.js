/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MockV1HistoryApi
const { EventEmitter } = require('events')
const _ = require('lodash')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()

module.exports = MockV1HistoryApi = {
  fakeZipCall: 0,
  requestedZipPacks: 0,
  sentChunks: 0,
  resetCounter() {
    MockV1HistoryApi.fakeZipCall = 0
    MockV1HistoryApi.sentChunks = 0
    MockV1HistoryApi.requestedZipPacks = 0
  },
  events: new EventEmitter(),
  run() {
    app.get(
      '/api/projects/:project_id/version/:version/zip',
      (req, res, next) => {
        res.header('content-disposition', 'attachment; name=project.zip')
        res.header('content-type', 'application/octet-stream')
        return res.send(
          `Mock zip for ${req.params.project_id} at version ${req.params.version}`
        )
      }
    )

    app.get(
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
        function writeChunk() {
          res.write('chunk' + MockV1HistoryApi.sentChunks++)
        }
        function writeEvery(interval) {
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

    app.post(
      '/api/projects/:project_id/version/:version/zip',
      (req, res, next) => {
        MockV1HistoryApi.requestedZipPacks++
        MockV1HistoryApi.events.emit('v1-history-pack-zip')
        return res.json({
          zipUrl: `http://localhost:3100/fake-zip-download/${req.params.project_id}/version/${req.params.version}`
        })
      }
    )

    return app
      .listen(3100, error => {
        if (error != null) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockV1HistoryApi:', error.message)
        return process.exit(1)
      })
  }
}

MockV1HistoryApi.run()
