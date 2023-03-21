// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MockDocUpdaterApi
const express = require('express')
const app = express()

module.exports = MockDocUpdaterApi = {
  docs: {},

  getAllDoc(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return callback(null, this.docs)
  },

  run() {
    app.get('/project/:project_id/doc', (req, res, next) => {
      return this.getAllDoc(req.params.project_id, (error, docs) => {
        if (error != null) {
          res.sendStatus(500)
        }
        if (docs == null) {
          return res.sendStatus(404)
        } else {
          return res.send(JSON.stringify(docs))
        }
      })
    })

    return app
      .listen(3016, error => {
        if (error != null) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockDocStoreApi:', error.message)
        return process.exit(1)
      })
  },
}

MockDocUpdaterApi.run()
