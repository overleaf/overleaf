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
let MockClsiApi
const express = require('express')
const bodyParser = require('body-parser')
const app = express()

module.exports = MockClsiApi = {
  run() {
    const compile = (req, res, next) => {
      return res.status(200).send({
        compile: {
          status: 'success',
          error: null,
          outputFiles: [
            {
              url: `/project/${
                req.params.project_id
              }/build/1234/output/project.pdf`,
              path: 'project.pdf',
              type: 'pdf',
              build: 1234
            },
            {
              url: `/project/${
                req.params.project_id
              }/build/1234/output/project.log`,
              path: 'project.log',
              type: 'log',
              build: 1234
            }
          ]
        }
      })
    }

    app.post('/project/:project_id/compile', compile)
    app.post('/project/:project_id/user/:user_id/compile', compile)

    app.get(
      '/project/:project_id/build/:build_id/output/*',
      (req, res, next) => {
        const filename = req.params[0]
        if (filename === 'project.pdf') {
          return res.status(200).send('mock-pdf')
        } else if (filename === 'project.log') {
          return res.status(200).send('mock-log')
        } else {
          return res.sendStatus(404)
        }
      }
    )

    app.get(
      '/project/:project_id/user/:user_id/build/:build_id/output/:output_path',
      (req, res, next) => {
        return res.status(200).send('hello')
      }
    )

    app.get('/project/:project_id/status', (req, res, next) => {
      return res.status(200).send()
    })

    return app
      .listen(3013, error => {
        if (error != null) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockClsiApi:', error.message)
        return process.exit(1)
      })
  }
}

MockClsiApi.run()
