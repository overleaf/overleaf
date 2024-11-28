/* eslint-disable
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
const express = require('express')
const Path = require('node:path')
const Client = require('./helpers/Client')
const sinon = require('sinon')
const ClsiApp = require('./helpers/ClsiApp')
const request = require('request')
const Settings = require('@overleaf/settings')

const Server = {
  run() {
    const app = express()

    const staticServer = express.static(Path.join(__dirname, '../fixtures/'))

    const alreadyFailed = new Map()
    app.get('/fail/:times/:id', (req, res) => {
      this.getFile(req.url)

      const soFar = alreadyFailed.get(req.params.id) || 0
      const wanted = parseInt(req.params.times, 10)
      if (soFar < wanted) {
        alreadyFailed.set(req.params.id, soFar + 1)
        res.status(503).end()
      } else {
        res.send('THE CONTENT')
      }
    })

    app.get('/not-found', (req, res, next) => {
      this.getFile(req.url)
      res.status(404).end()
    })

    app.get('/project/:projectId/file/:fileId', (req, res, next) => {
      this.getFile(req.url)
      return res.send(`${req.params.projectId}:${req.params.fileId}`)
    })

    app.get('/bucket/:bucket/key/*', (req, res, next) => {
      this.getFile(req.url)
      return res.send(`${req.params.bucket}:${req.params[0]}`)
    })

    app.get('/:random_id/*', (req, res, next) => {
      this.getFile(req.url)
      req.url = `/${req.params[0]}`
      return staticServer(req, res, next)
    })

    Client.startFakeFilestoreApp(app)
  },

  getFile() {},

  randomId() {
    return Math.random().toString(16).slice(2)
  },
}

describe('Url Caching', function () {
  Server.run()

  describe('Retries', function () {
    before(function (done) {
      this.project_id = Client.randomId()
      this.happyFile = `${Server.randomId()}/lion.png`
      this.retryFileOnce = `fail/1/${Server.randomId()}`
      this.retryFileTwice = `fail/2/${Server.randomId()}`
      this.fatalFile = `fail/42/${Server.randomId()}`
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
            url: `http://filestore/${this.happyFile}`,
          },
          {
            path: 'foo.tex',
            url: `http://filestore/${this.retryFileOnce}`,
          },
          {
            path: 'foo.tex',
            url: `http://filestore/${this.retryFileTwice}`,
          },
          {
            path: 'foo.tex',
            url: `http://filestore/${this.fatalFile}`,
          },
        ],
      }

      sinon.spy(Server, 'getFile')
      ClsiApp.ensureRunning(() => {
        Client.compile(this.project_id, this.request, (error, res, body) => {
          this.error = error
          this.res = res
          this.body = body
          done()
        })
      })
    })

    after(function () {
      Server.getFile.restore()
    })

    function expectNFilestoreRequests(file, count) {
      Server.getFile.args.filter(a => a[0] === file).should.have.length(count)
    }

    it('should download the happy file once', function () {
      expectNFilestoreRequests(`/${this.happyFile}`, 1)
    })
    it('should retry the download of the unhappy files', function () {
      expectNFilestoreRequests(`/${this.retryFileOnce}`, 2)
      expectNFilestoreRequests(`/${this.retryFileTwice}`, 3)
      expectNFilestoreRequests(`/${this.fatalFile}`, 3)
    })
  })

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
            url: `http://filestore/${this.file}`,
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
            url: `http://filestore/${this.file}`,
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

    it('should not download the image again', function () {
      return Server.getFile.called.should.equal(false)
    })

    it('should gather metrics', function (done) {
      request.get(`${Settings.apis.clsi.url}/metrics`, (err, res, body) => {
        if (err) return done(err)
        body
          .split('\n')
          .some(line => {
            return (
              line.startsWith('url_source') && line.includes('path="unknown"')
            )
          })
          .should.equal(true)
        done()
      })
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
            url: `http://filestore/${this.file}`,
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
            url: `http://filestore/${this.file}`,
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
            url: `http://filestore/${this.file}`,
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

  describe('After clearing the cache', function () {
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
            url: `http://filestore/${this.file}`,
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

  describe('fallbackURL', function () {
    describe('when the primary resource is available', function () {
      before(function (done) {
        this.project_id = Client.randomId()
        this.file = `/project/${Server.randomId()}/file/${Server.randomId()}`
        this.fallback = `/bucket/project-blobs/key/ab/cd/${Server.randomId()}`
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
              url: `http://filestore${this.file}`,
              fallbackURL: `http://filestore${this.fallback}`,
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

      after(function () {
        return Server.getFile.restore()
      })

      it('should download from the primary', function () {
        Server.getFile.calledWith(this.file).should.equal(true)
      })
      it('should not download from the fallback', function () {
        Server.getFile.calledWith(this.fallback).should.equal(false)
      })

      it('should gather metrics', function (done) {
        request.get(`${Settings.apis.clsi.url}/metrics`, (err, res, body) => {
          if (err) return done(err)
          body
            .split('\n')
            .some(line => {
              return (
                line.startsWith('url_source') &&
                line.includes('path="user-files"')
              )
            })
            .should.equal(true)
          done()
        })
      })
    })

    describe('when the primary resource is not available', function () {
      before(function (done) {
        this.project_id = Client.randomId()
        this.file = `/project/${Server.randomId()}/file/${Server.randomId()}`
        this.fallback = `/bucket/project-blobs/key/ab/cd/${Server.randomId()}`
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
              url: `http://filestore/not-found`,
              fallbackURL: `http://filestore${this.fallback}`,
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

      after(function () {
        return Server.getFile.restore()
      })

      it('should download from the fallback', function () {
        Server.getFile.calledWith(`/not-found`).should.equal(true)
        Server.getFile.calledWith(this.fallback).should.equal(true)
      })

      it('should gather metrics', function (done) {
        request.get(`${Settings.apis.clsi.url}/metrics`, (err, res, body) => {
          if (err) return done(err)
          body
            .split('\n')
            .some(line => {
              return (
                line.startsWith('url_source') &&
                line.includes('path="project-blobs"')
              )
            })
            .should.equal(true)
          done()
        })
      })
    })
  })
})
