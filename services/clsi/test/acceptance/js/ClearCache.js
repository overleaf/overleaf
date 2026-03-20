import { promisify } from 'node:util'
import Client from './helpers/Client.js'
import ClsiApp from './helpers/ClsiApp.js'
import { expect } from 'chai'

const sleep = promisify(setTimeout)

describe('Clear cache', function () {
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
      const res = await Client.clearCache(this.project_id)
      this.stopResult = { res }
    } catch (error) {
      this.stopResult = { error }
    }

    // allow time for the compile request to terminate
    await sleep(1000)
  })

  it('should emit a compile response with terminated status', function () {
    expect(this.stopResult.error).not.to.exist
    expect(this.stopResult.res.status).to.equal(204)
    expect(this.compileResult.error).not.to.exist
    expect(this.compileResult.body.compile.status).to.equal('terminated')
    expect(this.compileResult.body.compile.error).to.equal('terminated')
  })

  it('should return the log output file name', function () {
    const outputFilePaths = this.compileResult.body.compile.outputFiles.map(
      x => x.path
    )
    outputFilePaths.should.include('output.synctex(busy)') // compile was still pending
    outputFilePaths.should.include('output.log')
  })

  it('should work with not pending compile', async function () {
    const res = await Client.clearCache(this.project_id)
    expect(res.status).to.equal(204)
  })
})
