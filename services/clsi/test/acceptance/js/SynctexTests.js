const Client = require('./helpers/Client')
const { expect } = require('chai')
const ClsiApp = require('./helpers/ClsiApp')

describe('Syncing', function () {
  before(async function () {
    const content = `\
\\documentclass{article}
\\begin{document}
Hello world
\\end{document}\
`
    this.request = {
      resources: [
        {
          path: 'main.tex',
          content,
        },
      ],
    }
    this.project_id = Client.randomId()
    await ClsiApp.ensureRunning()
    this.body = await Client.compile(this.project_id, this.request)
  })

  describe('from code to pdf', function () {
    it('should return the correct location', async function () {
      const pdfPositions = await Client.syncFromCode(
        this.project_id,
        'main.tex',
        3,
        5
      )
      expect(pdfPositions).to.deep.equal({
        pdf: [
          {
            page: 1,
            h: 133.768356,
            v: 134.764618,
            height: 6.918498,
            width: 343.71106,
          },
        ],
        downloadedFromCache: false,
      })
    })
  })

  describe('from pdf to code', function () {
    it('should return the correct location', async function () {
      const codePositions = await Client.syncFromPdf(
        this.project_id,
        1,
        100,
        200
      )
      expect(codePositions).to.deep.equal({
        code: [{ file: 'main.tex', line: 3, column: -1 }],
        downloadedFromCache: false,
      })
    })
  })

  describe('when the project directory is not available', function () {
    before(function () {
      this.other_project_id = Client.randomId()
    })
    describe('from code to pdf', function () {
      it('should return a 404 response', async function () {
        const rejects = () =>
          expect(Client.syncFromCode(this.other_project_id, 'main.tex', 3, 5))
            .to.eventually.be.rejected

        await rejects().and.have.property('info').to.contain({ status: 404 })
        await rejects().and.have.property('body', 'Not Found')
      })
    })
    describe('from pdf to code', function () {
      it('should return a 404 response', async function () {
        const rejects = () =>
          expect(Client.syncFromPdf(this.other_project_id, 1, 100, 200)).to
            .eventually.be.rejected

        await rejects().and.have.property('info').to.contain({ status: 404 })
        await rejects().and.have.property('body', 'Not Found')
      })
    })
  })

  describe('when the synctex file is not available', function () {
    before(async function () {
      this.broken_project_id = Client.randomId()
      const content = 'this is not valid tex' // not a valid tex file
      this.request = {
        resources: [
          {
            path: 'main.tex',
            content,
          },
        ],
      }
      this.body = await Client.compile(this.broken_project_id, this.request)
    })

    describe('from code to pdf', function () {
      it('should return a 404 response', async function () {
        const rejects = () =>
          expect(Client.syncFromCode(this.broken_project_id, 'main.tex', 3, 5))
            .to.eventually.be.rejected

        await rejects().and.have.property('info').to.contain({ status: 404 })
        await rejects().and.have.property('body', 'Not Found')
      })
    })
    describe('from pdf to code', function () {
      it('should return a 404 response', async function () {
        const rejects = () =>
          expect(Client.syncFromPdf(this.broken_project_id, 1, 100, 200)).to
            .eventually.be.rejected

        await rejects().and.have.property('info').to.contain({ status: 404 })
        await rejects().and.have.property('body', 'Not Found')
      })
    })
  })
})
