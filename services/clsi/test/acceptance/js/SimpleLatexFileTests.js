/* eslint-disable
    handle-callback-err,
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

describe('Simple LaTeX file', function () {
  before(function (done) {
    this.project_id = Client.randomId()
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
    return ClsiApp.ensureRunning(() => {
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
  })

  it('should return the PDF', function () {
    const pdf = Client.getOutputFile(this.body, 'pdf')
    return pdf.type.should.equal('pdf')
  })

  it('should return the log', function () {
    const log = Client.getOutputFile(this.body, 'log')
    return log.type.should.equal('log')
  })

  it('should provide the pdf for download', function (done) {
    const pdf = Client.getOutputFile(this.body, 'pdf')
    return request.get(pdf.url, (error, res, body) => {
      res.statusCode.should.equal(200)
      return done()
    })
  })

  return it('should provide the log for download', function (done) {
    const log = Client.getOutputFile(this.body, 'pdf')
    return request.get(log.url, (error, res, body) => {
      res.statusCode.should.equal(200)
      return done()
    })
  })
})
