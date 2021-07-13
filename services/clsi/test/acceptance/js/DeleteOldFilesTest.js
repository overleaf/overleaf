/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Client = require('./helpers/Client')
const request = require('request')
const ClsiApp = require('./helpers/ClsiApp')

describe('Deleting Old Files', function () {
  before(function (done) {
    this.request = {
      resources: [
        {
          path: 'main.tex',
          content: `\
\\documentclass{article}
\\begin{document}
Hello world
\\end{document}\
`,
        },
      ],
    }
    return ClsiApp.ensureRunning(done)
  })

  return describe('on first run', function () {
    before(function (done) {
      this.project_id = Client.randomId()
      return Client.compile(
        this.project_id,
        this.request,
        (error, res, body) => {
          this.error = error
          this.res = res
          this.body = body
          return done()
        }
      )
    })

    it('should return a success status', function () {
      return this.body.compile.status.should.equal('success')
    })

    return describe('after file has been deleted', function () {
      before(function (done) {
        this.request.resources = []
        return Client.compile(
          this.project_id,
          this.request,
          (error, res, body) => {
            this.error = error
            this.res = res
            this.body = body
            return done()
          }
        )
      })

      return it('should return a failure status', function () {
        return this.body.compile.status.should.equal('failure')
      })
    })
  })
})
