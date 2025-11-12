const Client = require('./helpers/Client')
const { fetchNothing } = require('@overleaf/fetch-utils')
const ClsiApp = require('./helpers/ClsiApp')
const { expect } = require('chai')

describe('Simple LaTeX file', function () {
  const content = `\
\\documentclass{article}
\\begin{document}
Hello world
\\end{document}\
`
  const scenarios = [
    {
      description: 'simple file',
      request: {
        resources: [{ path: 'main.tex', content }],
      },
    },
    {
      description: 'clsi-perf request',
      request: {
        resources: [{ path: 'main.tex', content }],
        options: {
          metricsPath: 'clsi-perf',
          metricsMethod: 'priority',
        },
      },
    },
  ]

  for (const scenario of scenarios) {
    describe(scenario.description, function () {
      before(async function () {
        this.project_id = Client.randomId()
        this.request = scenario.request

        await ClsiApp.ensureRunning()
        try {
          this.body = await Client.compile(this.project_id, this.request)
        } catch (error) {
          this.error = error
        }
      })

      it('should return the PDF', function () {
        const pdf = Client.getOutputFile(this.body, 'pdf')
        pdf.type.should.equal('pdf')
      })

      it('should return the log', function () {
        const log = Client.getOutputFile(this.body, 'log')
        log.type.should.equal('log')
      })

      it('should provide the pdf for download', async function () {
        const pdf = Client.getOutputFile(this.body, 'pdf')
        const response = await fetchNothing(pdf.url)
        response.status.should.equal(200)
      })

      it('should provide the log for download', async function () {
        const log = Client.getOutputFile(this.body, 'pdf')
        const response = await fetchNothing(log.url)
        response.status.should.equal(200)
      })

      it('should return only the expected keys for stats and timings', function () {
        const { stats, timings } = this.body.compile
        // Note: chai's all.keys assertion rejects extra keys
        stats.should.have.all.keys(
          'isInitialCompile',
          'latexmk-errors',
          'latex-runs',
          'latex-runs-with-errors',
          'latex-runs-1',
          'latex-runs-with-errors-1',
          'pdf-caching-total-ranges-size',
          'pdf-caching-reclaimed-space',
          'pdf-caching-new-ranges-size',
          'pdf-caching-n-ranges',
          'pdf-caching-n-new-ranges',
          'pdf-size'
        )
        timings.should.have.all.keys(
          'sync',
          'compile',
          'output',
          'compileE2E',
          'compute-pdf-caching',
          'pdf-caching-overhead-delete-stale-hashes'
        )
      })
    })
  }

  describe('document with shell commands', function () {
    before(async function () {
      this.project_id = Client.randomId()
      this.request = {
        resources: [
          {
            path: 'main.tex',
            content: `\
\\documentclass{article}
\\begin{document}
Testing system calls:
\\immediate\\write18{/bin/date > date.txt}
The current date from system is: \\input{date.txt}
The current date from popen is: \\input{"|date"}
\\end{document}\
`,
          },
        ],
      }
      await ClsiApp.ensureRunning()
    })

    it('should compile successfully', async function () {
      const body = await Client.compile(this.project_id, this.request)
      expect(body).to.exist
      expect(body.compile?.status, 'compile status').to.equal('success')
    })

    it('should return the PDF', async function () {
      const body = await Client.compile(this.project_id, this.request)
      const pdf = Client.getOutputFile(body, 'pdf')
      expect(pdf, 'pdf file not produced').to.exist
      expect(pdf.type, 'invalid pdf file').to.equal('pdf')
    })
  })
})
