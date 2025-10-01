const Client = require('./helpers/Client')
const ClsiApp = require('./helpers/ClsiApp')
const { expect } = require('chai')

describe('AllowedImageNames', function () {
  beforeEach(async function () {
    this.project_id = Client.randomId()
    this.request = {
      options: {
        imageName: undefined,
      },
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

  describe('with a valid name', function () {
    beforeEach(async function () {
      this.request.options.imageName = process.env.TEXLIVE_IMAGE

      try {
        this.body = await Client.compile(this.project_id, this.request)
      } catch (error) {
        this.error = error
      }
    })
    it('should return success', function () {
      expect(this.error).not.to.exist
    })

    it('should return a PDF', function () {
      let pdf
      try {
        pdf = Client.getOutputFile(this.body, 'pdf')
      } catch (e) {}
      expect(pdf).to.exist
    })
  })

  describe('with an invalid name', function () {
    beforeEach(async function () {
      this.request.options.imageName = 'something/evil:1337'
      try {
        this.body = await Client.compile(this.project_id, this.request)
      } catch (error) {
        this.error = error
      }
    })
    it('should return non success', function () {
      expect(this.error.response.status).to.equal(500)
    })

    it('should not return a PDF', function () {
      let pdf
      try {
        pdf = Client.getOutputFile(this.body, 'pdf')
      } catch (e) {}
      expect(pdf).to.not.exist
    })
  })

  describe('syncToCode', function () {
    beforeEach(async function () {
      await Client.compile(this.project_id, this.request)
    })
    it('should error out with an invalid imageName', async function () {
      const rejects = () =>
        expect(
          Client.syncFromCodeWithImage(
            this.project_id,
            'main.tex',
            3,
            5,
            'something/evil:1337'
          )
        ).to.eventually.be.rejected

      await rejects().and.have.property('body', 'invalid image')
      await rejects().and.have.property('info').to.contain({ status: 400 })
    })

    it('should produce a mapping a valid imageName', async function () {
      const result = await Client.syncFromCodeWithImage(
        this.project_id,
        'main.tex',
        3,
        5,
        process.env.TEXLIVE_IMAGE
      )
      expect(result).to.deep.equal({
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

  describe('syncToPdf', function () {
    beforeEach(async function () {
      await Client.compile(this.project_id, this.request)
    })
    it('should error out with an invalid imageName', async function () {
      const rejects = () =>
        expect(
          Client.syncFromPdfWithImage(
            this.project_id,
            'main.tex',
            100,
            200,
            'something/evil:1337'
          )
        ).to.eventually.be.rejected

      await rejects().and.have.property('body', 'invalid image')
      await rejects().and.have.property('info').to.contain({ status: 400 })
    })

    it('should produce a mapping a valid imageName', async function () {
      const result = await Client.syncFromPdfWithImage(
        this.project_id,
        1,
        100,
        200,
        process.env.TEXLIVE_IMAGE
      )
      expect(result).to.deep.equal({
        code: [{ file: 'main.tex', line: 3, column: -1 }],
        downloadedFromCache: false,
      })
    })
  })

  describe('wordcount', function () {
    beforeEach(async function () {
      await Client.compile(this.project_id, this.request)
    })
    it('should error out with an invalid imageName', async function () {
      const rejects = () =>
        expect(
          Client.wordcountWithImage(
            this.project_id,
            'main.tex',
            'something/evil:1337'
          )
        ).to.eventually.be.rejected

      await rejects().and.have.property('body', 'invalid image')
      await rejects().and.have.property('info').to.contain({ status: 400 })
    })

    it('should produce a texcout a valid imageName', async function () {
      const result = await Client.wordcountWithImage(
        this.project_id,
        'main.tex',
        process.env.TEXLIVE_IMAGE
      )
      expect(result).to.exist
      expect(result.texcount).to.exist
    })
  })
})
