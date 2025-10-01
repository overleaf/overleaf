const express = require('express')
const Path = require('node:path')
const Client = require('./helpers/Client')
const sinon = require('sinon')
const ClsiApp = require('./helpers/ClsiApp')
const { fetchString } = require('@overleaf/fetch-utils')
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
      res.send(`${req.params.projectId}:${req.params.fileId}`)
    })

    app.get('/bucket/:bucket/key/*', (req, res, next) => {
      this.getFile(req.url)
      res.send(`${req.params.bucket}:${req.params[0]}`)
    })

    app.get('/:random_id/*', (req, res, next) => {
      this.getFile(req.url)
      req.url = `/${req.params[0]}`
      staticServer(req, res, next)
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
    before(async function () {
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
      await ClsiApp.ensureRunning()
      this.body = await Client.compile(this.project_id, this.request)
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
    before(async function () {
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
      await ClsiApp.ensureRunning()
      this.body = await Client.compile(this.project_id, this.request)
    })

    afterEach(function () {
      Server.getFile.restore()
    })

    it('should download the image', function () {
      Server.getFile.calledWith(`/${this.file}`).should.equal(true)
    })
  })

  describe('When an image is in the cache and the last modified date is unchanged', function () {
    before(async function () {
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

      await Client.compile(this.project_id, this.request)
      sinon.spy(Server, 'getFile')
      await Client.compile(this.project_id, this.request)
    })

    after(function () {
      Server.getFile.restore()
    })

    it('should not download the image again', function () {
      Server.getFile.called.should.equal(false)
    })

    it('should gather metrics', async function () {
      const body = await fetchString(`${Settings.apis.clsi.url}/metrics`)
      body
        .split('\n')
        .some(line => {
          return (
            line.startsWith('url_source') && line.includes('path="unknown"')
          )
        })
        .should.equal(true)
    })
  })

  describe('When an image is in the cache and the last modified date is advanced', function () {
    before(async function () {
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

      await Client.compile(this.project_id, this.request)

      sinon.spy(Server, 'getFile')
      this.image_resource.modified = new Date(this.last_modified + 3000)

      await Client.compile(this.project_id, this.request)
    })

    afterEach(function () {
      Server.getFile.restore()
    })

    it('should download the image again', function () {
      Server.getFile.called.should.equal(true)
    })
  })

  describe('When an image is in the cache and the last modified date is further in the past', function () {
    before(async function () {
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

      await Client.compile(this.project_id, this.request)

      sinon.spy(Server, 'getFile')
      this.image_resource.modified = new Date(this.last_modified - 3000)

      await Client.compile(this.project_id, this.request)
    })

    afterEach(function () {
      Server.getFile.restore()
    })

    it('should download the other revision', function () {
      Server.getFile.called.should.equal(true)
    })
  })

  describe('When an image is in the cache and the last modified date is not specified', function () {
    before(async function () {
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

      await Client.compile(this.project_id, this.request)

      sinon.spy(Server, 'getFile')
      delete this.image_resource.modified

      await Client.compile(this.project_id, this.request)
    })

    afterEach(function () {
      Server.getFile.restore()
    })

    it('should download the image again', function () {
      Server.getFile.called.should.equal(true)
    })
  })

  describe('After clearing the cache', function () {
    before(async function () {
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

      await Client.compile(this.project_id, this.request)
      await Client.clearCache(this.project_id)

      sinon.spy(Server, 'getFile')

      await Client.compile(this.project_id, this.request)
    })

    afterEach(function () {
      Server.getFile.restore()
    })

    it('should download the image again', function () {
      Server.getFile.called.should.equal(true)
    })
  })

  describe('fallbackURL', function () {
    describe('when the primary resource is available', function () {
      before(async function () {
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
        await ClsiApp.ensureRunning()
        await Client.compile(this.project_id, this.request)
      })

      after(function () {
        Server.getFile.restore()
      })

      it('should download from the primary', function () {
        Server.getFile.calledWith(this.file).should.equal(true)
      })
      it('should not download from the fallback', function () {
        Server.getFile.calledWith(this.fallback).should.equal(false)
      })

      it('should gather metrics', async function () {
        const body = await fetchString(`${Settings.apis.clsi.url}/metrics`)
        body
          .split('\n')
          .some(line => {
            return (
              line.startsWith('url_source') &&
              line.includes('path="user-files"')
            )
          })
          .should.equal(true)
      })
    })

    describe('when the primary resource is not available', function () {
      before(async function () {
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
        await ClsiApp.ensureRunning()
        await Client.compile(this.project_id, this.request)
      })

      after(function () {
        Server.getFile.restore()
      })

      it('should download from the fallback', function () {
        Server.getFile.calledWith(`/not-found`).should.equal(true)
        Server.getFile.calledWith(this.fallback).should.equal(true)
      })

      it('should gather metrics', async function () {
        const body = await fetchString(`${Settings.apis.clsi.url}/metrics`)
        body
          .split('\n')
          .some(line => {
            return (
              line.startsWith('url_source') &&
              line.includes('path="project-blobs"')
            )
          })
          .should.equal(true)
      })
    })
  })
})
