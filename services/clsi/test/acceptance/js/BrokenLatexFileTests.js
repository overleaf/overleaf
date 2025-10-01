const Client = require('./helpers/Client')
const ClsiApp = require('./helpers/ClsiApp')
const { expect } = require('chai')

describe('Broken LaTeX file', function () {
  before(async function () {
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
    await ClsiApp.ensureRunning()
  })

  describe('on first run', function () {
    before(async function () {
      this.project_id = Client.randomId()
      this.body = await Client.compile(this.project_id, this.broken_request)
    })

    it('should return a failure status', function () {
      this.body.compile.status.should.equal('failure')
    })

    it('should return isInitialCompile flag', function () {
      expect(this.body.compile.stats.isInitialCompile).to.equal(1)
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

  describe('on second run', function () {
    before(async function () {
      this.project_id = Client.randomId()
      await Client.compile(this.project_id, this.correct_request)
      this.body = await Client.compile(this.project_id, this.broken_request)
    })

    it('should return a failure status', function () {
      this.body.compile.status.should.equal('failure')
    })

    it('should not return isInitialCompile flag', function () {
      expect(this.body.compile.stats.isInitialCompile).to.not.exist
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
