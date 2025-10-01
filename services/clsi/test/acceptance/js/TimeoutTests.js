const Client = require('./helpers/Client')
const ClsiApp = require('./helpers/ClsiApp')
const { expect } = require('chai')

describe('Timed out compile', function () {
  before(async function () {
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
    await ClsiApp.ensureRunning()
    this.body = await Client.compile(this.project_id, this.request)
  })

  it('should return a timeout error', function () {
    this.body.compile.error.should.equal('container timed out')
  })

  it('should return a timedout status', function () {
    this.body.compile.status.should.equal('timedout')
  })

  it('should return isInitialCompile flag', function () {
    expect(this.body.compile.stats.isInitialCompile).to.equal(1)
  })

  it('should return the log output file name', function () {
    const outputFilePaths = this.body.compile.outputFiles.map(x => x.path)
    outputFilePaths.should.include('output.log')
  })
})
