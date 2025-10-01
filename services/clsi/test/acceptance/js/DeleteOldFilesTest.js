const Client = require('./helpers/Client')
const ClsiApp = require('./helpers/ClsiApp')

describe('Deleting Old Files', function () {
  before(async function () {
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
    await ClsiApp.ensureRunning()
  })

  describe('on first run', function () {
    before(async function () {
      this.project_id = Client.randomId()
      this.body = await Client.compile(this.project_id, this.request)
    })

    it('should return a success status', function () {
      this.body.compile.status.should.equal('success')
    })

    describe('after file has been deleted', function () {
      before(async function () {
        this.request.resources = []
        this.body = await Client.compile(this.project_id, this.request)
      })

      it('should return a failure status', function () {
        this.body.compile.status.should.equal('failure')
      })
    })
  })
})
