/* eslint-disable
    camelcase,
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MockTrackChangesApi
const express = require('express')
const app = express()

module.exports = MockTrackChangesApi = {
  flushDoc(doc_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return callback()
  },

  run() {
    app.post('/project/:project_id/doc/:doc_id/flush', (req, res, next) => {
      return this.flushDoc(req.params.doc_id, error => {
        if (error != null) {
          return res.sendStatus(500)
        } else {
          return res.sendStatus(204)
        }
      })
    })

    return app
      .listen(3015, error => {
        if (error != null) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockTrackChangesApi:', error.message)
        return process.exit(1)
      })
  },
}

MockTrackChangesApi.run()
