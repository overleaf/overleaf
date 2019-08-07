/* eslint-disable
    camelcase,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MockDocStoreApi
const express = require('express')
const bodyParser = require('body-parser')
const app = express()

module.exports = MockDocStoreApi = {
  docs: {},

  run() {
    app.post(
      '/project/:project_id/doc/:doc_id',
      bodyParser.json(),
      (req, res, next) => {
        const { project_id, doc_id } = req.params
        const { lines, version, ranges } = req.body
        if (this.docs[project_id] == null) {
          this.docs[project_id] = {}
        }
        this.docs[project_id][doc_id] = { lines, version, ranges }
        if (this.docs[project_id][doc_id].rev == null) {
          this.docs[project_id][doc_id].rev = 0
        }
        this.docs[project_id][doc_id].rev += 1
        this.docs[project_id][doc_id]._id = doc_id
        return res.json({
          modified: true,
          rev: this.docs[project_id][doc_id].rev
        })
      }
    )

    app.get('/project/:project_id/doc', (req, res, next) => {
      const docs = (() => {
        const result = []
        for (let doc_id in this.docs[req.params.project_id]) {
          const doc = this.docs[req.params.project_id][doc_id]
          result.push(doc)
        }
        return result
      })()
      return res.json(docs)
    })

    app.get('/project/:project_id/doc/:doc_id', (req, res, next) => {
      const { project_id, doc_id } = req.params
      const doc = this.docs[project_id][doc_id]
      if (doc == null || (doc.deleted && !req.query.include_deleted)) {
        return res.sendStatus(404)
      } else {
        return res.json(doc)
      }
    })

    app.delete('/project/:project_id/doc/:doc_id', (req, res, next) => {
      const { project_id, doc_id } = req.params
      if (this.docs[project_id] == null) {
        return res.sendStatus(404)
      } else if (this.docs[project_id][doc_id] == null) {
        return res.sendStatus(404)
      } else {
        this.docs[project_id][doc_id].deleted = true
        return res.sendStatus(204)
      }
    })

    app.post('/project/:project_id/destroy', (req, res, next) => {
      const { project_id } = req.params
      delete this.docs[project_id]
      res.sendStatus(204)
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
  }
}

MockDocStoreApi.run()
