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
const { expect } = require('chai')

describe('Timed out compile', function () {
  before(function (done) {
    this.request = {
      options: {
        timeout: 10,
      }, // seconds
      resources: [
        {
          path: 'main.tex',
          content: `\
\\documentclass{article}
\\begin{document}
\\def\\x{Hello!\\par\\x}
\\x
\\end{document}\
`,
        },
      ],
    }
    this.project_id = Client.randomId()
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

  it('should return a timeout error', function () {
    return this.body.compile.error.should.equal('container timed out')
  })

  it('should return a timedout status', function () {
    return this.body.compile.status.should.equal('timedout')
  })

  it('should return isInitialCompile flag', function () {
    expect(this.body.compile.stats.isInitialCompile).to.equal(1)
  })

  return it('should return the log output file name', function () {
    const outputFilePaths = this.body.compile.outputFiles.map(x => x.path)
    return outputFilePaths.should.include('output.log')
  })
})
