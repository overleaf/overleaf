/* eslint-disable
    no-path-concat,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Client = require('./helpers/Client')
const sinon = require('sinon')
const ClsiApp = require('./helpers/ClsiApp')

const host = 'localhost'

const Server = {
  run() {
    const express = require('express')
    const app = express()

    const staticServer = express.static(__dirname + '/../fixtures/')
    app.get('/:random_id/*', (req, res, next) => {
      this.getFile(req.url)
      req.url = `/${req.params[0]}`
      return staticServer(req, res, next)
    })

    return app.listen(31415, host)
  },

  getFile() {},

  randomId() {
    return Math.random().toString(16).slice(2)
  },
}

Server.run()

describe('Url Caching', function () {
  describe('Downloading an image for the first time', function () {
    before(function (done) {
      this.project_id = Client.randomId()
      this.file = `${Server.randomId()}/lion.png`
      this.request = {
        resources: [
          {
            path: 'main.tex',
            content: `\
\\documentclass{article}
\\usepackage{graphicx}
\\begin{document}
\\includegraphics{lion.png}
\\end{document}\
`,
          },
          {
            path: 'lion.png',
            url: `http://${host}:31415/${this.file}`,
          },
        ],
      }

      sinon.spy(Server, 'getFile')
      return ClsiApp.ensureRunning(() => {
        return Client.compile(
          this.project_id,
          this.request,
          (error, res, body) => {
            this.error = error
            this.res = res
            this.body = body
            return done()
          }
        )
      })
    })

    afterEach(function () {
      return Server.getFile.restore()
    })

    return it('should download the image', function () {
      return Server.getFile.calledWith(`/${this.file}`).should.equal(true)
    })
  })

  describe('When an image is in the cache and the last modified date is unchanged', function () {
    before(function (done) {
      this.project_id = Client.randomId()
      this.file = `${Server.randomId()}/lion.png`
      this.request = {
        resources: [
          {
            path: 'main.tex',
            content: `\
\\documentclass{article}
\\usepackage{graphicx}
\\begin{document}
\\includegraphics{lion.png}
\\end{document}\
`,
          },
          (this.image_resource = {
            path: 'lion.png',
            url: `http://${host}:31415/${this.file}`,
            modified: Date.now(),
          }),
        ],
      }

      return Client.compile(
        this.project_id,
        this.request,
        (error, res, body) => {
          this.error = error
          this.res = res
          this.body = body
          sinon.spy(Server, 'getFile')
          return Client.compile(
            this.project_id,
            this.request,
            (error1, res1, body1) => {
              this.error = error1
              this.res = res1
              this.body = body1
              return done()
            }
          )
        }
      )
    })

    after(function () {
      return Server.getFile.restore()
    })

    return it('should not download the image again', function () {
      return Server.getFile.called.should.equal(false)
    })
  })

  describe('When an image is in the cache and the last modified date is advanced', function () {
    before(function (done) {
      this.project_id = Client.randomId()
      this.file = `${Server.randomId()}/lion.png`
      this.request = {
        resources: [
          {
            path: 'main.tex',
            content: `\
\\documentclass{article}
\\usepackage{graphicx}
\\begin{document}
\\includegraphics{lion.png}
\\end{document}\
`,
          },
          (this.image_resource = {
            path: 'lion.png',
            url: `http://${host}:31415/${this.file}`,
            modified: (this.last_modified = Date.now()),
          }),
        ],
      }

      return Client.compile(
        this.project_id,
        this.request,
        (error, res, body) => {
          this.error = error
          this.res = res
          this.body = body
          sinon.spy(Server, 'getFile')
          this.image_resource.modified = new Date(this.last_modified + 3000)
          return Client.compile(
            this.project_id,
            this.request,
            (error1, res1, body1) => {
              this.error = error1
              this.res = res1
              this.body = body1
              return done()
            }
          )
        }
      )
    })

    afterEach(function () {
      return Server.getFile.restore()
    })

    return it('should download the image again', function () {
      return Server.getFile.called.should.equal(true)
    })
  })

  describe('When an image is in the cache and the last modified date is further in the past', function () {
    before(function (done) {
      this.project_id = Client.randomId()
      this.file = `${Server.randomId()}/lion.png`
      this.request = {
        resources: [
          {
            path: 'main.tex',
            content: `\
\\documentclass{article}
\\usepackage{graphicx}
\\begin{document}
\\includegraphics{lion.png}
\\end{document}\
`,
          },
          (this.image_resource = {
            path: 'lion.png',
            url: `http://${host}:31415/${this.file}`,
            modified: (this.last_modified = Date.now()),
          }),
        ],
      }

      return Client.compile(
        this.project_id,
        this.request,
        (error, res, body) => {
          this.error = error
          this.res = res
          this.body = body
          sinon.spy(Server, 'getFile')
          this.image_resource.modified = new Date(this.last_modified - 3000)
          return Client.compile(
            this.project_id,
            this.request,
            (error1, res1, body1) => {
              this.error = error1
              this.res = res1
              this.body = body1
              return done()
            }
          )
        }
      )
    })

    afterEach(function () {
      return Server.getFile.restore()
    })

    return it('should download the other revision', function () {
      return Server.getFile.called.should.equal(true)
    })
  })

  describe('When an image is in the cache and the last modified date is not specified', function () {
    before(function (done) {
      this.project_id = Client.randomId()
      this.file = `${Server.randomId()}/lion.png`
      this.request = {
        resources: [
          {
            path: 'main.tex',
            content: `\
\\documentclass{article}
\\usepackage{graphicx}
\\begin{document}
\\includegraphics{lion.png}
\\end{document}\
`,
          },
          (this.image_resource = {
            path: 'lion.png',
            url: `http://${host}:31415/${this.file}`,
            modified: (this.last_modified = Date.now()),
          }),
        ],
      }

      return Client.compile(
        this.project_id,
        this.request,
        (error, res, body) => {
          this.error = error
          this.res = res
          this.body = body
          sinon.spy(Server, 'getFile')
          delete this.image_resource.modified
          return Client.compile(
            this.project_id,
            this.request,
            (error1, res1, body1) => {
              this.error = error1
              this.res = res1
              this.body = body1
              return done()
            }
          )
        }
      )
    })

    afterEach(function () {
      return Server.getFile.restore()
    })

    return it('should download the image again', function () {
      return Server.getFile.called.should.equal(true)
    })
  })

  return describe('After clearing the cache', function () {
    before(function (done) {
      this.project_id = Client.randomId()
      this.file = `${Server.randomId()}/lion.png`
      this.request = {
        resources: [
          {
            path: 'main.tex',
            content: `\
\\documentclass{article}
\\usepackage{graphicx}
\\begin{document}
\\includegraphics{lion.png}
\\end{document}\
`,
          },
          (this.image_resource = {
            path: 'lion.png',
            url: `http://${host}:31415/${this.file}`,
            modified: (this.last_modified = Date.now()),
          }),
        ],
      }

      return Client.compile(this.project_id, this.request, error => {
        if (error != null) {
          throw error
        }
        return Client.clearCache(this.project_id, (error, res, body) => {
          if (error != null) {
            throw error
          }
          sinon.spy(Server, 'getFile')
          return Client.compile(
            this.project_id,
            this.request,
            (error1, res1, body1) => {
              this.error = error1
              this.res = res1
              this.body = body1
              return done()
            }
          )
        })
      })
    })

    afterEach(function () {
      return Server.getFile.restore()
    })

    return it('should download the image again', function () {
      return Server.getFile.called.should.equal(true)
    })
  })
})
