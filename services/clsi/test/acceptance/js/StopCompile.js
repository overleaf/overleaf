const { promisify } = require('node:util')
const Client = require('./helpers/Client')
const ClsiApp = require('./helpers/ClsiApp')
const { expect } = require('chai')

const sleep = promisify(setTimeout)

describe('Stop compile', function () {
  before(async function () {
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
    await ClsiApp.ensureRunning()

    // start the compile in the background
    Client.compile(this.project_id, this.request)
      .then(body => {
        this.compileResult = { body }
      })
      .catch(error => {
        this.compileResult = { error }
      })

    // wait for 1 second before stopping the compile
    await sleep(1000)

    try {
      const res = await Client.stopCompile(this.project_id)
      this.stopResult = { res }
    } catch (error) {
      this.stopResult = { error }
    }

    // allow time for the compile request to terminate
    await sleep(1000)
  })

  it('should force a compile response with an error status', function () {
    expect(this.stopResult.error).not.to.exist
    expect(this.stopResult.res.status).to.equal(204)
    expect(this.compileResult.error).not.to.exist
    expect(this.compileResult.body.compile.status).to.equal('terminated')
    expect(this.compileResult.body.compile.error).to.equal('terminated')
  })
})
