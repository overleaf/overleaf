/* eslint-disable
    camelcase,
    no-undef,
*/
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
const bodyParser = require('body-parser')
const app = express()
app.use(bodyParser.json())

module.exports = MockDocUpdaterApi = {
  docs: {},

  getDoc(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return callback(null, this.docs[doc_id])
  },

  setDoc(project_id, doc_id, lines, user_id, undoing, callback) {
    if (callback == null) {
      callback = function () {}
    }
    if (!this.docs[doc_id]) {
      this.docs[doc_id] = {}
    }
    this.docs[doc_id].lines = lines
    return callback()
  },

  run() {
    app.get('/project/:project_id/doc/:doc_id', (req, res, next) => {
      return this.getDoc(
        req.params.project_id,
        req.params.doc_id,
        (error, doc) => {
          if (error != null) {
            res.sendStatus(500)
          }
          if (doc == null) {
            return res.sendStatus(404)
          } else {
            return res.send(JSON.stringify(doc))
          }
        }
      )
    })

    app.post('/project/:project_id/doc/:doc_id', (req, res, next) => {
      return this.setDoc(
        req.params.project_id,
        req.params.doc_id,
        req.body.lines,
        req.body.user_id,
        req.body.undoing,
        (errr, doc) => {
          if (typeof error !== 'undefined' && error !== null) {
            return res.sendStatus(500)
          } else {
            return res.sendStatus(204)
          }
        }
      )
    })

    return app
      .listen(3003, error => {
        if (error != null) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockDocUpdaterApi:', error.message)
        return process.exit(1)
      })
  },
}

MockDocUpdaterApi.run()
