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
const _ = require('lodash')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const { ObjectId } = require('mongojs')

module.exports = MockV1HistoryApi = {
  fakeZipCall: 0,
  run() {
    app.get(
      '/api/projects/:project_id/version/:version/zip',
      (req, res, next) => {
        res.header('content-disposition', 'attachment; name=project.zip')
        res.header('content-type', 'application/octet-stream')
        return res.send(
          `Mock zip for ${req.params.project_id} at version ${
            req.params.version
          }`
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
        return res.send(
          `Mock zip for ${req.params.project_id} at version ${
            req.params.version
          }`
        )
      }
    )

    app.post(
      '/api/projects/:project_id/version/:version/zip',
      (req, res, next) => {
        return res.json({
          zipUrl: `http://localhost:3100/fake-zip-download/${
            req.params.project_id
          }/version/${req.params.version}`
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
