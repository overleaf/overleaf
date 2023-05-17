/* eslint-disable mocha/handle-done-callback */
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/Compile/CompileController.js'
const SandboxedModule = require('sandboxed-module')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')

describe('CompileController', function () {
  beforeEach(function () {
    this.user_id = 'wat'
    this.user = {
      _id: this.user_id,
      email: 'user@example.com',
      features: {
        compileGroup: 'premium',
        compileTimeout: 100,
      },
    }
    this.CompileManager = { compile: sinon.stub() }
    this.ClsiManager = {}
    this.UserGetter = { getUser: sinon.stub() }
    this.rateLimiter = {
      consume: sinon.stub().resolves(),
    }
    this.RateLimiter = {
      RateLimiter: sinon.stub().returns(this.rateLimiter),
    }
    this.settings = {
      apis: {
        clsi: {
          url: 'clsi.example.com',
          defaultBackendClass: 'e2',
        },
        clsi_priority: {
          url: 'clsi-priority.example.com',
        },
      },
      defaultFeatures: {
        compileGroup: 'standard',
        compileTimeout: 60,
      },
    }
    this.jar = { cookie: 'stuff' }
    this.ClsiCookieManager = {
      getCookieJar: sinon.stub().yields(null, this.jar),
    }
    this.SessionManager = {
      getLoggedInUser: sinon.stub().callsArgWith(1, null, this.user),
      getLoggedInUserId: sinon.stub().returns(this.user_id),
      getSessionUser: sinon.stub().returns(this.user),
      isUserLoggedIn: sinon.stub().returns(true),
    }
    this.CompileController = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        request: (this.request = sinon.stub()),
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        '@overleaf/metrics': (this.Metrics = { inc: sinon.stub() }),
        './CompileManager': this.CompileManager,
        '../User/UserGetter': this.UserGetter,
        './ClsiManager': this.ClsiManager,
        '../Authentication/SessionManager': this.SessionManager,
        '../../infrastructure/RateLimiter': this.RateLimiter,
        './ClsiCookieManager': () => this.ClsiCookieManager,
        '../SplitTests/SplitTestHandler': {
          getAssignment: (this.getAssignment = sinon.stub().yields(null, {
            variant: 'default',
          })),
          promises: {
            getAssignment: sinon.stub().resolves({
              variant: 'default',
            }),
          },
        },
        '../Analytics/AnalyticsManager': {
          recordEventForSession: sinon.stub(),
        },
      },
    })
    this.projectId = 'project-id'
    this.next = sinon.stub()
    this.req = new MockRequest()
    this.res = new MockResponse()
  })

  describe('compile', function () {
    beforeEach(function () {
      this.req.params = { Project_id: this.projectId }
      this.req.session = {}
      this.CompileManager.compile = sinon.stub().callsArgWith(
        3,
        null,
        (this.status = 'success'),
        (this.outputFiles = [
          {
            path: 'output.pdf',
            url: `/project/${this.projectId}/user/${this.user_id}/build/id/output.pdf`,
            type: 'pdf',
          },
        ])
      )
    })

    describe('pdfDownloadDomain', function () {
      beforeEach(function () {
        this.settings.pdfDownloadDomain = 'https://compiles.overleaf.test'
      })

      describe('when clsi does not emit zone prefix', function () {
        beforeEach(function (done) {
          this.res.callback = done
          this.CompileController.compile(this.req, this.res, this.next)
        })

        it('should add domain verbatim', function () {
          this.res.statusCode.should.equal(200)
          this.res.body.should.equal(
            JSON.stringify({
              status: this.status,
              outputFiles: [
                {
                  path: 'output.pdf',
                  url: `/project/${this.projectId}/user/${this.user_id}/build/id/output.pdf`,
                  type: 'pdf',
                },
              ],
              pdfDownloadDomain: 'https://compiles.overleaf.test',
              enableHybridPdfDownload: false,
              forceNewDomainVariant: 'default',
            })
          )
        })
      })

      describe('when clsi emits a zone prefix', function () {
        beforeEach(function (done) {
          this.res.callback = done
          this.CompileManager.compile = sinon.stub().callsArgWith(
            3,
            null,
            (this.status = 'success'),
            (this.outputFiles = [
              {
                path: 'output.pdf',
                url: `/project/${this.projectId}/user/${this.user_id}/build/id/output.pdf`,
                type: 'pdf',
              },
            ]),
            undefined, // clsiServerId
            undefined, // limits
            undefined, // validationProblems
            undefined, // stats
            undefined, // timings
            '/zone/b'
          )
          this.CompileController.compile(this.req, this.res, this.next)
        })

        it('should add the zone prefix', function () {
          this.res.statusCode.should.equal(200)
          this.res.body.should.equal(
            JSON.stringify({
              status: this.status,
              outputFiles: [
                {
                  path: 'output.pdf',
                  url: `/project/${this.projectId}/user/${this.user_id}/build/id/output.pdf`,
                  type: 'pdf',
                },
              ],
              pdfDownloadDomain: 'https://compiles.overleaf.test/zone/b',
              enableHybridPdfDownload: false,
              forceNewDomainVariant: 'default',
            })
          )
        })
      })
    })

    describe('when not an auto compile', function () {
      beforeEach(function (done) {
        this.res.callback = done
        this.CompileController.compile(this.req, this.res, this.next)
      })

      it('should look up the user id', function () {
        this.SessionManager.getLoggedInUserId
          .calledWith(this.req.session)
          .should.equal(true)
      })

      it('should do the compile without the auto compile flag', function () {
        this.CompileManager.compile.should.have.been.calledWith(
          this.projectId,
          this.user_id,
          {
            isAutoCompile: false,
            enablePdfCaching: false,
            fileLineErrors: false,
            stopOnFirstError: false,
          }
        )
      })

      it('should set the content-type of the response to application/json', function () {
        this.res.type.should.equal('application/json')
      })

      it('should send a successful response reporting the status and files', function () {
        this.res.statusCode.should.equal(200)
        this.res.body.should.equal(
          JSON.stringify({
            status: this.status,
            outputFiles: this.outputFiles,
            enableHybridPdfDownload: false,
            forceNewDomainVariant: 'default',
          })
        )
      })
    })

    describe('when an auto compile', function () {
      beforeEach(function (done) {
        this.res.callback = done
        this.req.query = { auto_compile: 'true' }
        this.CompileController.compile(this.req, this.res, this.next)
      })

      it('should do the compile with the auto compile flag', function () {
        this.CompileManager.compile.should.have.been.calledWith(
          this.projectId,
          this.user_id,
          {
            isAutoCompile: true,
            enablePdfCaching: false,
            fileLineErrors: false,
            stopOnFirstError: false,
          }
        )
      })
    })

    describe('with the draft attribute', function () {
      beforeEach(function (done) {
        this.res.callback = done
        this.req.body = { draft: true }
        this.CompileController.compile(this.req, this.res, this.next)
      })

      it('should do the compile without the draft compile flag', function () {
        this.CompileManager.compile.should.have.been.calledWith(
          this.projectId,
          this.user_id,
          {
            isAutoCompile: false,
            enablePdfCaching: false,
            draft: true,
            fileLineErrors: false,
            stopOnFirstError: false,
          }
        )
      })
    })
  })

  describe('compileSubmission', function () {
    beforeEach(function () {
      this.submission_id = 'sub-1234'
      this.req.params = { submission_id: this.submission_id }
      this.req.body = {}
      this.ClsiManager.sendExternalRequest = sinon
        .stub()
        .callsArgWith(
          3,
          null,
          (this.status = 'success'),
          (this.outputFiles = ['mock-output-files']),
          (this.clsiServerId = 'mock-server-id'),
          (this.validationProblems = null)
        )
    })

    it('should set the content-type of the response to application/json', function () {
      this.CompileController.compileSubmission(this.req, this.res, this.next)
      this.res.contentType.calledWith('application/json').should.equal(true)
    })

    it('should send a successful response reporting the status and files', function () {
      this.CompileController.compileSubmission(this.req, this.res, this.next)
      this.res.statusCode.should.equal(200)
      this.res.body.should.equal(
        JSON.stringify({
          status: this.status,
          outputFiles: this.outputFiles,
          clsiServerId: 'mock-server-id',
          validationProblems: null,
        })
      )
    })

    describe('with compileGroup and timeout', function () {
      beforeEach(function () {
        this.req.body = {
          compileGroup: 'special',
          timeout: 600,
        }
        this.CompileController.compileSubmission(this.req, this.res, this.next)
      })

      it('should use the supplied values', function () {
        this.ClsiManager.sendExternalRequest.should.have.been.calledWith(
          this.submission_id,
          { compileGroup: 'special', timeout: 600 },
          { compileGroup: 'special', compileBackendClass: 'e2', timeout: 600 }
        )
      })
    })

    describe('with other supported options but not compileGroup and timeout', function () {
      beforeEach(function () {
        this.req.body = {
          rootResourcePath: 'main.tex',
          compiler: 'lualatex',
          draft: true,
          check: 'validate',
        }
        this.CompileController.compileSubmission(this.req, this.res, this.next)
      })

      it('should use the other options but default values for compileGroup and timeout', function () {
        this.ClsiManager.sendExternalRequest.should.have.been.calledWith(
          this.submission_id,
          {
            rootResourcePath: 'main.tex',
            compiler: 'lualatex',
            draft: true,
            check: 'validate',
          },
          {
            rootResourcePath: 'main.tex',
            compiler: 'lualatex',
            draft: true,
            check: 'validate',
            compileGroup: 'standard',
            compileBackendClass: 'e2',
            timeout: 60,
          }
        )
      })
    })
  })

  describe('downloadPdf', function () {
    beforeEach(function () {
      this.req.params = { Project_id: this.projectId }

      this.req.query = { pdfng: true }
      this.project = { name: 'test namè; 1' }
      this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, this.project)
    })

    describe('when downloading for embedding', function () {
      beforeEach(function () {
        this.CompileController.proxyToClsi = sinon.stub()
        this.CompileController.downloadPdf(this.req, this.res, this.next)
      })

      it('should look up the project', function () {
        this.ProjectGetter.getProject
          .calledWith(this.projectId, { name: 1 })
          .should.equal(true)
      })

      it('should set the content-type of the response to application/pdf', function () {
        this.res.contentType.calledWith('application/pdf').should.equal(true)
      })

      it('should set the content-disposition header with a safe version of the project name', function () {
        this.res.setContentDisposition.should.be.calledWith('inline', {
          filename: 'test_namè__1.pdf',
        })
      })

      it('should increment the pdf-downloads metric', function () {
        this.Metrics.inc.calledWith('pdf-downloads').should.equal(true)
      })

      it('should proxy the PDF from the CLSI', function () {
        this.CompileController.proxyToClsi
          .calledWith(
            this.projectId,
            `/project/${this.projectId}/user/${this.user_id}/output/output.pdf`,
            this.req,
            this.res,
            this.next
          )
          .should.equal(true)
      })
    })

    describe('when the a build-id is provided', function () {
      beforeEach(function () {
        this.req.params.build_id = this.buildId = '1234-5678'
        this.CompileController.proxyToClsi = sinon.stub()
        this.CompileController.downloadPdf(this.req, this.res, this.next)
      })

      it('should proxy the PDF from the CLSI, with a build-id', function () {
        this.CompileController.proxyToClsi
          .calledWith(
            this.projectId,
            `/project/${this.projectId}/user/${this.user_id}/build/${this.buildId}/output/output.pdf`,
            this.req,
            this.res,
            this.next
          )
          .should.equal(true)
      })
    })

    describe('when the pdf is not going to be used in pdfjs viewer', function () {
      it('should check the rate limiter when pdfng is not set', function (done) {
        this.req.query = {}
        this.CompileController.proxyToClsi = (projectId, url) => {
          expect(this.rateLimiter.consume).to.have.been.called
          done()
        }
        this.CompileController.downloadPdf(this.req, this.res)
      })

      it('should check the rate limiter when pdfng is false', function (done) {
        this.req.query = { pdfng: false }
        this.CompileController.proxyToClsi = (projectId, url) => {
          expect(this.rateLimiter.consume).to.have.been.called
          done()
        }
        this.CompileController.downloadPdf(this.req, this.res)
      })
    })
  })

  describe('getFileFromClsiWithoutUser', function () {
    beforeEach(function () {
      this.submission_id = 'sub-1234'
      this.build_id = 123456
      this.file = 'project.pdf'
      this.req.params = {
        submission_id: this.submission_id,
        build_id: this.build_id,
        file: this.file,
      }
      this.req.body = {}
      this.expected_url = `/project/${this.submission_id}/build/${this.build_id}/output/${this.file}`
      this.CompileController.proxyToClsiWithLimits = sinon.stub()
    })

    describe('without limits specified', function () {
      beforeEach(function () {
        this.CompileController.getFileFromClsiWithoutUser(
          this.req,
          this.res,
          this.next
        )
      })

      it('should proxy to CLSI with correct URL and default limits', function () {
        this.CompileController.proxyToClsiWithLimits.should.have.been.calledWith(
          this.submission_id,
          this.expected_url,
          {
            compileGroup: 'standard',
            compileBackendClass: 'e2',
          }
        )
      })
    })

    describe('with limits specified', function () {
      beforeEach(function () {
        this.req.body = { compileTimeout: 600, compileGroup: 'special' }
        this.CompileController.getFileFromClsiWithoutUser(
          this.req,
          this.res,
          this.next
        )
      })

      it('should proxy to CLSI with correct URL and specified limits', function () {
        this.CompileController.proxyToClsiWithLimits.should.have.been.calledWith(
          this.submission_id,
          this.expected_url,
          {
            compileGroup: 'special',
            compileBackendClass: 'e2',
          }
        )
      })
    })
  })
  describe('proxySyncCode', function () {
    let file, line, column, imageName

    beforeEach(function (done) {
      this.req.params = { Project_id: this.projectId }
      file = 'main.tex'
      line = String(Date.now())
      column = String(Date.now() + 1)
      this.req.query = { file, line, column }

      imageName = 'foo/bar:tag-0'
      this.ProjectGetter.getProject = sinon.stub().yields(null, { imageName })

      this.next.callsFake(done)
      this.res.callback = done
      this.CompileController.proxyToClsi = sinon.stub().callsFake(() => done())

      this.CompileController.proxySyncCode(this.req, this.res, this.next)
    })

    it('should proxy the request with an imageName', function () {
      expect(this.CompileController.proxyToClsi).to.have.been.calledWith(
        this.projectId,
        {
          url: `/project/${this.projectId}/user/${this.user_id}/sync/code`,
          qs: { file, line, column, imageName },
        },
        this.req,
        this.res,
        this.next
      )
    })
  })

  describe('proxySyncPdf', function () {
    let page, h, v, imageName

    beforeEach(function (done) {
      this.req.params = { Project_id: this.projectId }
      page = String(Date.now())
      h = String(Math.random())
      v = String(Math.random())
      this.req.query = { page, h, v }

      imageName = 'foo/bar:tag-1'
      this.ProjectGetter.getProject = sinon.stub().yields(null, { imageName })

      this.next.callsFake(done)
      this.res.callback = done
      this.CompileController.proxyToClsi = sinon.stub().callsFake(() => done())

      this.CompileController.proxySyncPdf(this.req, this.res, this.next)
    })

    it('should proxy the request with an imageName', function () {
      expect(this.CompileController.proxyToClsi).to.have.been.calledWith(
        this.projectId,
        {
          url: `/project/${this.projectId}/user/${this.user_id}/sync/pdf`,
          qs: { page, h, v, imageName },
        },
        this.req,
        this.res,
        this.next
      )
    })
  })

  describe('proxyToClsi', function () {
    beforeEach(function () {
      this.request.returns(
        (this.proxy = {
          pipe: sinon.stub(),
          on: sinon.stub(),
        })
      )
      this.upstream = {
        statusCode: 204,
        headers: { mock: 'header' },
      }
      this.req.method = 'mock-method'
      this.req.headers = {
        Mock: 'Headers',
        Range: '123-456',
        'If-Range': 'abcdef',
        'If-Modified-Since': 'Mon, 15 Dec 2014 15:23:56 GMT',
      }
    })

    describe('old pdf viewer', function () {
      describe('user with standard priority', function () {
        beforeEach(function () {
          this.CompileManager.getProjectCompileLimits = sinon
            .stub()
            .callsArgWith(1, null, {
              compileGroup: 'standard',
              compileBackendClass: 'e2',
            })
          this.CompileController.proxyToClsi(
            this.projectId,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })

        it('should open a request to the CLSI', function () {
          this.request
            .calledWith({
              jar: this.jar,
              qs: { compileGroup: 'standard', compileBackendClass: 'e2' },
              method: this.req.method,
              url: `${this.settings.apis.clsi.url}${this.url}`,
              timeout: 60 * 1000,
            })
            .should.equal(true)
        })

        it('should pass the request on to the client', function () {
          this.proxy.pipe.calledWith(this.res).should.equal(true)
        })

        it('should bind an error handle to the request proxy', function () {
          this.proxy.on.calledWith('error').should.equal(true)
        })
      })

      describe('user with priority compile', function () {
        beforeEach(function () {
          this.CompileManager.getProjectCompileLimits = sinon
            .stub()
            .callsArgWith(1, null, { compileGroup: 'priority' })
          this.CompileController.proxyToClsi(
            this.projectId,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })
      })

      describe('user with standard priority via query string', function () {
        beforeEach(function () {
          this.req.query = { compileGroup: 'standard' }
          this.CompileManager.getProjectCompileLimits = sinon
            .stub()
            .callsArgWith(1, null, {
              compileGroup: 'standard',
              compileBackendClass: 'e2',
            })
          this.CompileController.proxyToClsi(
            this.projectId,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })

        it('should open a request to the CLSI', function () {
          this.request
            .calledWith({
              jar: this.jar,
              qs: { compileGroup: 'standard', compileBackendClass: 'e2' },
              method: this.req.method,
              url: `${this.settings.apis.clsi.url}${this.url}`,
              timeout: 60 * 1000,
            })
            .should.equal(true)
        })

        it('should pass the request on to the client', function () {
          this.proxy.pipe.calledWith(this.res).should.equal(true)
        })

        it('should bind an error handle to the request proxy', function () {
          this.proxy.on.calledWith('error').should.equal(true)
        })
      })

      describe('user with non-existent priority via query string', function () {
        beforeEach(function () {
          this.req.query = { compileGroup: 'foobar' }
          this.CompileManager.getProjectCompileLimits = sinon
            .stub()
            .callsArgWith(1, null, {
              compileGroup: 'standard',
              compileBackendClass: 'e2',
            })
          this.CompileController.proxyToClsi(
            this.projectId,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })

        it('should proxy to the standard url', function () {
          this.request
            .calledWith({
              jar: this.jar,
              qs: { compileGroup: 'standard', compileBackendClass: 'e2' },
              method: this.req.method,
              url: `${this.settings.apis.clsi.url}${this.url}`,
              timeout: 60 * 1000,
            })
            .should.equal(true)
        })
      })

      describe('user with build parameter via query string', function () {
        beforeEach(function () {
          this.CompileManager.getProjectCompileLimits = sinon
            .stub()
            .callsArgWith(1, null, {
              compileGroup: 'standard',
              compileBackendClass: 'e2',
            })
          this.req.query = { build: 1234 }
          this.CompileController.proxyToClsi(
            this.projectId,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })

        it('should proxy to the standard url without the build parameter', function () {
          this.request
            .calledWith({
              jar: this.jar,
              qs: { compileGroup: 'standard', compileBackendClass: 'e2' },
              method: this.req.method,
              url: `${this.settings.apis.clsi.url}${this.url}`,
              timeout: 60 * 1000,
            })
            .should.equal(true)
        })
      })
    })

    describe('new pdf viewer', function () {
      beforeEach(function () {
        this.req.query = { pdfng: true }
      })
      describe('user with standard priority', function () {
        beforeEach(function () {
          this.CompileManager.getProjectCompileLimits = sinon
            .stub()
            .callsArgWith(1, null, {
              compileGroup: 'standard',
              compileBackendClass: 'e2',
            })
          this.CompileController.proxyToClsi(
            this.projectId,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })

        it('should open a request to the CLSI', function () {
          this.request
            .calledWith({
              jar: this.jar,
              qs: { compileGroup: 'standard', compileBackendClass: 'e2' },
              method: this.req.method,
              url: `${this.settings.apis.clsi.url}${this.url}`,
              timeout: 60 * 1000,
              headers: {
                Range: '123-456',
                'If-Range': 'abcdef',
                'If-Modified-Since': 'Mon, 15 Dec 2014 15:23:56 GMT',
              },
            })
            .should.equal(true)
        })

        it('should pass the request on to the client', function () {
          this.proxy.pipe.calledWith(this.res).should.equal(true)
        })

        it('should bind an error handle to the request proxy', function () {
          this.proxy.on.calledWith('error').should.equal(true)
        })
      })

      describe('user with build parameter via query string', function () {
        beforeEach(function () {
          this.CompileManager.getProjectCompileLimits = sinon
            .stub()
            .callsArgWith(1, null, {
              compileGroup: 'standard',
              compileBackendClass: 'e2',
            })
          this.req.query = { build: 1234, pdfng: true }
          this.CompileController.proxyToClsi(
            this.projectId,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })

        it('should proxy to the standard url with the build parameter', function () {
          this.request
            .calledWith({
              jar: this.jar,
              method: this.req.method,
              qs: {
                build: 1234,
                compileGroup: 'standard',
                compileBackendClass: 'e2',
              },
              url: `${this.settings.apis.clsi.url}${this.url}`,
              timeout: 60 * 1000,
              headers: {
                Range: '123-456',
                'If-Range': 'abcdef',
                'If-Modified-Since': 'Mon, 15 Dec 2014 15:23:56 GMT',
              },
            })
            .should.equal(true)
        })
      })
    })
  })

  describe('deleteAuxFiles', function () {
    beforeEach(function () {
      this.CompileManager.deleteAuxFiles = sinon.stub().yields()
      this.req.params = { Project_id: this.projectId }
      this.req.query = { clsiserverid: 'node-1' }
      this.res.sendStatus = sinon.stub()
      this.CompileController.deleteAuxFiles(this.req, this.res, this.next)
    })

    it('should proxy to the CLSI', function () {
      this.CompileManager.deleteAuxFiles
        .calledWith(this.projectId, this.user_id, 'node-1')
        .should.equal(true)
    })

    it('should return a 200', function () {
      this.res.sendStatus.calledWith(200).should.equal(true)
    })
  })

  describe('compileAndDownloadPdf', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.projectId,
        },
      }
      this.CompileManager.compile.callsArgWith(3)
      this.CompileController.proxyToClsi = sinon.stub()
      this.res = { send: () => {}, sendStatus: sinon.stub() }
    })

    it('should call compile in the compile manager', function (done) {
      this.CompileController.compileAndDownloadPdf(this.req, this.res)
      this.CompileManager.compile.calledWith(this.projectId).should.equal(true)
      done()
    })

    it('should proxy the res to the clsi with correct url', function (done) {
      this.CompileController.compileAndDownloadPdf(this.req, this.res)
      sinon.assert.calledWith(
        this.CompileController.proxyToClsi,
        this.projectId,
        `/project/${this.projectId}/output/output.pdf`,
        this.req,
        this.res
      )

      this.CompileController.proxyToClsi
        .calledWith(
          this.projectId,
          `/project/${this.projectId}/output/output.pdf`,
          this.req,
          this.res
        )
        .should.equal(true)
      done()
    })

    it('should not download anything on compilation failures', function () {
      this.CompileManager.compile.yields(new Error('failed'))
      this.CompileController.compileAndDownloadPdf(this.req, this.res)
      this.res.sendStatus.should.have.been.calledWith(500)
      this.CompileController.proxyToClsi.should.not.have.been.called
    })
  })

  describe('wordCount', function () {
    beforeEach(function () {
      this.CompileManager.wordCount = sinon
        .stub()
        .yields(null, { content: 'body' })
      this.req.params = { Project_id: this.projectId }
      this.req.query = { clsiserverid: 'node-42' }
      this.res.json = sinon.stub()
      this.res.contentType = sinon.stub()
      this.CompileController.wordCount(this.req, this.res, this.next)
    })

    it('should proxy to the CLSI', function () {
      this.CompileManager.wordCount
        .calledWith(this.projectId, this.user_id, false, 'node-42')
        .should.equal(true)
    })

    it('should return a 200 and body', function () {
      this.res.json.calledWith({ content: 'body' }).should.equal(true)
    })
  })
})
