/* eslint-disable
    camelcase,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MockFileStoreApi
const express = require('express')
const bodyParser = require('body-parser')
const app = express()

module.exports = MockFileStoreApi = {
  files: {},

  run() {
    app.post('/project/:project_id/file/:file_id', (req, res, next) => {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))

      return req.on('end', () => {
        const content = Buffer.concat(chunks).toString()
        const { project_id, file_id } = req.params
        if (this.files[project_id] == null) {
          this.files[project_id] = {}
        }
        this.files[project_id][file_id] = { content }
        return res.sendStatus(200)
      })
    })

    app.get('/project/:project_id/file/:file_id', (req, res, next) => {
      const { project_id, file_id } = req.params
      const { content } = this.files[project_id][file_id]
      return res.send(content)
    })

    // handle file copying
    app.put(
      '/project/:project_id/file/:file_id',
      bodyParser.json(),
      (req, res, next) => {
        const { project_id, file_id } = req.params
        const { source } = req.body
        const { content } =
          this.files[source.project_id] != null
            ? this.files[source.project_id][source.file_id]
            : undefined
        if (content == null) {
          return res.sendStatus(500)
        } else {
          if (this.files[project_id] == null) {
            this.files[project_id] = {}
          }
          this.files[project_id][file_id] = { content }
          return res.sendStatus(200)
        }
      }
    )

    return app
      .listen(3009, error => {
        if (error != null) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockFileStoreApi:', error.message)
        return process.exit(1)
      })
  }
}

MockFileStoreApi.run()
