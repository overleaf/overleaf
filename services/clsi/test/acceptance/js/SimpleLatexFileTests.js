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
const Settings = require('@overleaf/settings')

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
      options: {
        metricsPath: 'clsi-perf',
        metricsMethod: 'priority',
      },
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
      if (error) return done(error)
      res.statusCode.should.equal(200)
      return done()
    })
  })

  it('should provide the log for download', function (done) {
    const log = Client.getOutputFile(this.body, 'pdf')
    return request.get(log.url, (error, res, body) => {
      if (error) return done(error)
      res.statusCode.should.equal(200)
      return done()
    })
  })

  it('should gather personalized metrics', function (done) {
    request.get(`${Settings.apis.clsi.url}/metrics`, (err, res, body) => {
      if (err) return done(err)
      body
        .split('\n')
        .some(line => {
          return (
            line.startsWith('compile') &&
            line.includes('path="clsi-perf"') &&
            line.includes('method="priority"')
          )
        })
        .should.equal(true)
      done()
    })
  })
})
