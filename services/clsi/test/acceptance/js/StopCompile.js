const Client = require('./helpers/Client')
const ClsiApp = require('./helpers/ClsiApp')
const { expect } = require('chai')

describe('Stop compile', function () {
  before(function (done) {
    this.request = {
      options: {
        timeout: 100,
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
    ClsiApp.ensureRunning(() => {
      // start the compile in the background
      Client.compile(this.project_id, this.request, (error, res, body) => {
        this.compileResult = { error, res, body }
      })
      // wait for 1 second before stopping the compile
      setTimeout(() => {
        Client.stopCompile(this.project_id, (error, res, body) => {
          this.stopResult = { error, res, body }
          setTimeout(done, 1000) // allow time for the compile request to terminate
        })
      }, 1000)
    })
  })

  it('should force a compile response with an error status', function () {
    expect(this.stopResult.error).to.be.null
    expect(this.stopResult.res.statusCode).to.equal(204)
    expect(this.compileResult.res.statusCode).to.equal(200)
    expect(this.compileResult.body.compile.status).to.equal('terminated')
    expect(this.compileResult.body.compile.error).to.equal('terminated')
  })
})
