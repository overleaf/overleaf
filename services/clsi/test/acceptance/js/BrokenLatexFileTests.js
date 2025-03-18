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

describe('Broken LaTeX file', function () {
  before(function (done) {
    this.broken_request = {
      resources: [
        {
          path: 'main.tex',
          content: `\
\\documentclass{articl % :(
\\begin{documen % :(
Broken
\\end{documen % :(\
`,
        },
      ],
    }
    this.correct_request = {
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

  describe('on first run', function () {
    before(function (done) {
      this.project_id = Client.randomId()
      return Client.compile(
        this.project_id,
        this.broken_request,
        (error, res, body) => {
          this.error = error
          this.res = res
          this.body = body
          return done()
        }
      )
    })

    it('should return a failure status', function () {
      return this.body.compile.status.should.equal('failure')
    })

    it('should return output files', function () {
      // NOTE: No output.pdf file.
      this.body.compile.outputFiles
        .map(f => f.path)
        .should.deep.equal([
          'output.aux',
          'output.fdb_latexmk',
          'output.fls',
          'output.log',
          'output.stderr',
          'output.stdout',
        ])
    })
  })

  return describe('on second run', function () {
    before(function (done) {
      this.project_id = Client.randomId()
      return Client.compile(this.project_id, this.correct_request, () => {
        return Client.compile(
          this.project_id,
          this.broken_request,
          (error, res, body) => {
            this.error = error
            this.res = res
            this.body = body
            return done()
          }
        )
      })
    })

    it('should return a failure status', function () {
      return this.body.compile.status.should.equal('failure')
    })

    it('should return output files', function () {
      // NOTE: No output.pdf file.
      this.body.compile.outputFiles
        .map(f => f.path)
        .should.deep.equal([
          'output.aux',
          'output.fdb_latexmk',
          'output.fls',
          'output.log',
          'output.stderr',
          'output.stdout',
        ])
    })
  })
})
