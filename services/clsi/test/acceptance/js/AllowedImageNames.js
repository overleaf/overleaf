const Client = require('./helpers/Client')
const ClsiApp = require('./helpers/ClsiApp')
const { expect } = require('chai')

describe('AllowedImageNames', function() {
  beforeEach(function(done) {
    this.project_id = Client.randomId()
    this.request = {
      options: {
        imageName: undefined
      },
      resources: [
        {
          path: 'main.tex',
          content: `\
\\documentclass{article}
\\begin{document}
Hello world
\\end{document}\
`
        }
      ]
    }
    ClsiApp.ensureRunning(done)
  })

  describe('with a valid name', function() {
    beforeEach(function(done) {
      this.request.options.imageName = process.env.TEXLIVE_IMAGE

      Client.compile(this.project_id, this.request, (error, res, body) => {
        this.error = error
        this.res = res
        this.body = body
        done(error)
      })
    })
    it('should return success', function() {
      expect(this.res.statusCode).to.equal(200)
    })

    it('should return a PDF', function() {
      let pdf
      try {
        pdf = Client.getOutputFile(this.body, 'pdf')
      } catch (e) {}
      expect(pdf).to.exist
    })
  })

  describe('with an invalid name', function() {
    beforeEach(function(done) {
      this.request.options.imageName = 'something/evil:1337'
      Client.compile(this.project_id, this.request, (error, res, body) => {
        this.error = error
        this.res = res
        this.body = body
        done(error)
      })
    })
    it('should return non success', function() {
      expect(this.res.statusCode).to.not.equal(200)
    })

    it('should not return a PDF', function() {
      let pdf
      try {
        pdf = Client.getOutputFile(this.body, 'pdf')
      } catch (e) {}
      expect(pdf).to.not.exist
    })
  })
})
