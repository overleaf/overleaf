const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/Compile/CompileController.js'
const SandboxedModule = require('sandboxed-module')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const { Headers } = require('node-fetch')
const { ReadableString } = require('@overleaf/stream-utils')

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
    this.CompileManager = {
      promises: {
        compile: sinon.stub(),
        getProjectCompileLimits: sinon.stub(),
        syncTeX: sinon.stub(),
      },
    }
    this.ClsiManager = {
      promises: {},
    }
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
          url: 'http://clsi.example.com',
          submissionBackendClass: 'n2d',
        },
        clsi_priority: {
          url: 'http://clsi-priority.example.com',
        },
      },
      defaultFeatures: {
        compileGroup: 'standard',
        compileTimeout: 60,
      },
      clsiCookie: {
        key: 'cookie-key',
      },
    }
    this.ClsiCookieManager = {
      promises: {
        getServerId: sinon.stub().resolves('clsi-server-id-from-redis'),
      },
    }
    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(this.user_id),
      getSessionUser: sinon.stub().returns(this.user),
      isUserLoggedIn: sinon.stub().returns(true),
    }
    this.pipeline = sinon.stub().callsFake(async (stream, res) => {
      if (res.callback) res.callback()
    })
    this.clsiStream = new ReadableString('{}')
    this.clsiResponse = {
      headers: new Headers({
        'Content-Length': '2',
        'Content-Type': 'application/json',
      }),
    }
    this.fetchUtils = {
      fetchStreamWithResponse: sinon.stub().resolves({
        stream: this.clsiStream,
        response: this.clsiResponse,
      }),
    }
    this.CompileController = SandboxedModule.require(modulePath, {
      requires: {
        'stream/promises': { pipeline: this.pipeline },
        '@overleaf/settings': this.settings,
        '@overleaf/fetch-utils': this.fetchUtils,
        '../Project/ProjectGetter': (this.ProjectGetter = {
          promises: {},
        }),
        '@overleaf/metrics': (this.Metrics = {
          inc: sinon.stub(),
          Timer: class {
            constructor() {
              this.labels = {}
            }

            done() {}
          },
        }),
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
    this.build_id = '18fbe9e7564-30dcb2f71250c690'
    this.next = sinon.stub()
    this.req = new MockRequest()
    this.res = new MockResponse()
    this.res = new MockResponse()
  })

  describe('compile', function () {
    beforeEach(function () {
      this.req.params = { Project_id: this.projectId }
      this.req.session = {}
      this.CompileManager.promises.compile = sinon.stub().resolves({
        status: (this.status = 'success'),
        outputFiles: (this.outputFiles = [
          {
            path: 'output.pdf',
            url: `/project/${this.projectId}/user/${this.user_id}/build/id/output.pdf`,
            type: 'pdf',
          },
        ]),
        clsiServerId: undefined,
        limits: undefined,
        validationProblems: undefined,
        stats: undefined,
        timings: undefined,
        outputUrlPrefix: undefined,
        buildId: this.build_id,
      })
    })

    describe('pdfDownloadDomain', function () {
      beforeEach(function () {
        this.settings.pdfDownloadDomain = 'https://compiles.overleaf.test'
      })

      describe('when clsi does not emit zone prefix', function () {
        beforeEach(async function () {
          await this.CompileController.compile(this.req, this.res, this.next)
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
              outputFilesArchive: {
                path: 'output.zip',
                url: `/project/${this.projectId}/user/wat/build/${this.build_id}/output/output.zip`,
                type: 'zip',
              },
              pdfDownloadDomain: 'https://compiles.overleaf.test',
            })
          )
        })
      })

      describe('when clsi emits a zone prefix', function () {
        beforeEach(async function () {
          this.CompileManager.promises.compile = sinon.stub().resolves({
            status: (this.status = 'success'),
            outputFiles: (this.outputFiles = [
              {
                path: 'output.pdf',
                url: `/project/${this.projectId}/user/${this.user_id}/build/id/output.pdf`,
                type: 'pdf',
              },
            ]),
            clsiServerId: undefined,
            limits: undefined,
            validationProblems: undefined,
            stats: undefined,
            timings: undefined,
            outputUrlPrefix: '/zone/b',
            buildId: this.build_id,
          })
          await this.CompileController.compile(this.req, this.res, this.next)
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
              outputFilesArchive: {
                path: 'output.zip',
                url: `/project/${this.projectId}/user/wat/build/${this.build_id}/output/output.zip`,
                type: 'zip',
              },
              outputUrlPrefix: '/zone/b',
              pdfDownloadDomain: 'https://compiles.overleaf.test/zone/b',
            })
          )
        })
      })
    })

    describe('when not an auto compile', function () {
      beforeEach(async function () {
        await this.CompileController.compile(this.req, this.res, this.next)
      })

      it('should look up the user id', function () {
        this.SessionManager.getLoggedInUserId
          .calledWith(this.req.session)
          .should.equal(true)
      })

      it('should do the compile without the auto compile flag', function () {
        this.CompileManager.promises.compile.should.have.been.calledWith(
          this.projectId,
          this.user_id,
          {
            isAutoCompile: false,
            compileFromClsiCache: false,
            populateClsiCache: false,
            enablePdfCaching: false,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: undefined,
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
            outputFilesArchive: {
              path: 'output.zip',
              url: `/project/${this.projectId}/user/wat/build/${this.build_id}/output/output.zip`,
              type: 'zip',
            },
          })
        )
      })
    })

    describe('when an auto compile', function () {
      beforeEach(async function () {
        this.req.query = { auto_compile: 'true' }
        await this.CompileController.compile(this.req, this.res, this.next)
      })

      it('should do the compile with the auto compile flag', function () {
        this.CompileManager.promises.compile.should.have.been.calledWith(
          this.projectId,
          this.user_id,
          {
            isAutoCompile: true,
            compileFromClsiCache: false,
            populateClsiCache: false,
            enablePdfCaching: false,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: undefined,
          }
        )
      })
    })

    describe('with the draft attribute', function () {
      beforeEach(async function () {
        this.req.body = { draft: true }
        await this.CompileController.compile(this.req, this.res, this.next)
      })

      it('should do the compile without the draft compile flag', function () {
        this.CompileManager.promises.compile.should.have.been.calledWith(
          this.projectId,
          this.user_id,
          {
            isAutoCompile: false,
            compileFromClsiCache: false,
            populateClsiCache: false,
            enablePdfCaching: false,
            draft: true,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: undefined,
          }
        )
      })
    })

    describe('with an editor id', function () {
      beforeEach(async function () {
        this.req.body = { editorId: 'the-editor-id' }
        await this.CompileController.compile(this.req, this.res, this.next)
      })

      it('should pass the editor id to the compiler', function () {
        this.CompileManager.promises.compile.should.have.been.calledWith(
          this.projectId,
          this.user_id,
          {
            isAutoCompile: false,
            compileFromClsiCache: false,
            populateClsiCache: false,
            enablePdfCaching: false,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: 'the-editor-id',
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
      this.ClsiManager.promises.sendExternalRequest = sinon.stub().resolves({
        status: (this.status = 'success'),
        outputFiles: (this.outputFiles = ['mock-output-files']),
        clsiServerId: 'mock-server-id',
        validationProblems: null,
      })
    })

    it('should set the content-type of the response to application/json', async function () {
      await this.CompileController.compileSubmission(
        this.req,
        this.res,
        this.next
      )
      this.res.contentType.calledWith('application/json').should.equal(true)
    })

    it('should send a successful response reporting the status and files', async function () {
      await this.CompileController.compileSubmission(
        this.req,
        this.res,
        this.next
      )
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
        this.ClsiManager.promises.sendExternalRequest.should.have.been.calledWith(
          this.submission_id,
          { compileGroup: 'special', timeout: 600 },
          { compileGroup: 'special', compileBackendClass: 'n2d', timeout: 600 }
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
        this.ClsiManager.promises.sendExternalRequest.should.have.been.calledWith(
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
            compileBackendClass: 'n2d',
            timeout: 60,
          }
        )
      })
    })
  })

  describe('downloadPdf', function () {
    beforeEach(function () {
      this.CompileController._proxyToClsi = sinon.stub().resolves()
      this.req.params = { Project_id: this.projectId }
      this.project = { name: 'test namè; 1' }
      this.ProjectGetter.promises.getProject = sinon
        .stub()
        .resolves(this.project)
    })

    describe('when downloading for embedding', function () {
      beforeEach(async function () {
        await this.CompileController.downloadPdf(this.req, this.res, this.next)
      })

      it('should look up the project', function () {
        this.ProjectGetter.promises.getProject
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
        this.CompileController._proxyToClsi
          .calledWith(
            this.projectId,
            'output-file',
            `/project/${this.projectId}/user/${this.user_id}/output/output.pdf`,
            {},
            this.req,
            this.res
          )
          .should.equal(true)
      })
    })

    describe('when a build-id is provided', function () {
      beforeEach(async function () {
        this.req.params.build_id = this.build_id
        await this.CompileController.downloadPdf(this.req, this.res, this.next)
      })

      it('should proxy the PDF from the CLSI, with a build-id', function () {
        this.CompileController._proxyToClsi
          .calledWith(
            this.projectId,
            'output-file',
            `/project/${this.projectId}/user/${this.user_id}/build/${this.build_id}/output/output.pdf`,
            {},
            this.req,
            this.res
          )
          .should.equal(true)
      })
    })

    describe('when rate-limited', function () {
      beforeEach(async function () {
        this.rateLimiter.consume.rejects({
          msBeforeNext: 250,
          remainingPoints: 0,
          consumedPoints: 5,
          isFirstInDuration: false,
        })
      })
      it('should return 500', async function () {
        await this.CompileController.downloadPdf(this.req, this.res, this.next)
        // should it be 429 instead?
        this.res.sendStatus.calledWith(500).should.equal(true)
        this.CompileController._proxyToClsi.should.not.have.been.called
      })
    })

    describe('when rate-limit errors', function () {
      beforeEach(async function () {
        this.rateLimiter.consume.rejects(new Error('uh oh'))
      })
      it('should return 500', async function () {
        await this.CompileController.downloadPdf(this.req, this.res, this.next)
        this.res.sendStatus.calledWith(500).should.equal(true)
        this.CompileController._proxyToClsi.should.not.have.been.called
      })
    })
  })

  describe('getFileFromClsiWithoutUser', function () {
    beforeEach(function () {
      this.submission_id = 'sub-1234'
      this.file = 'output.pdf'
      this.req.params = {
        submission_id: this.submission_id,
        build_id: this.build_id,
        file: this.file,
      }
      this.req.body = {}
      this.expected_url = `/project/${this.submission_id}/build/${this.build_id}/output/${this.file}`
      this.CompileController._proxyToClsiWithLimits = sinon.stub()
    })

    describe('without limits specified', function () {
      beforeEach(async function () {
        await this.CompileController.getFileFromClsiWithoutUser(
          this.req,
          this.res,
          this.next
        )
      })

      it('should proxy to CLSI with correct URL and default limits', function () {
        this.CompileController._proxyToClsiWithLimits.should.have.been.calledWith(
          this.submission_id,
          'output-file',
          this.expected_url,
          {},
          { compileGroup: 'standard', compileBackendClass: 'n2d' }
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
        this.CompileController._proxyToClsiWithLimits.should.have.been.calledWith(
          this.submission_id,
          'output-file',
          this.expected_url,
          {},
          {
            compileGroup: 'special',
            compileBackendClass: 'n2d',
          }
        )
      })
    })
  })
  describe('proxySyncCode', function () {
    let file, line, column, imageName, editorId, buildId, clsiServerId

    beforeEach(async function () {
      this.req.params = { Project_id: this.projectId }
      clsiServerId = 'clsi-1'
      file = 'main.tex'
      line = String(Date.now())
      column = String(Date.now() + 1)
      editorId = '172977cb-361e-4854-a4dc-a71cf11512e5'
      buildId = '195b4a3f9e7-03e5be430a9e7796'
      this.req.query = {
        file,
        line,
        column,
        editorId,
        buildId,
        clsiserverid: clsiServerId,
      }

      imageName = 'foo/bar:tag-0'
      this.ProjectGetter.promises.getProject = sinon
        .stub()
        .resolves({ imageName })

      this.CompileController._proxyToClsi = sinon.stub().resolves()

      await this.CompileController.proxySyncCode(this.req, this.res, this.next)
    })

    it('should parse the parameters', function () {
      expect(this.CompileManager.promises.syncTeX).to.have.been.calledWith(
        this.projectId,
        this.user_id,
        {
          direction: 'code',
          compileFromClsiCache: false,
          validatedOptions: {
            file,
            line,
            column,
            editorId,
            buildId,
          },
          clsiServerId,
        }
      )
    })
  })

  describe('proxySyncPdf', function () {
    let page, h, v, imageName, editorId, buildId, clsiServerId

    beforeEach(async function () {
      this.req.params = { Project_id: this.projectId }
      clsiServerId = 'clsi-1'
      page = String(Date.now())
      h = String(Math.random())
      v = String(Math.random())
      editorId = '172977cb-361e-4854-a4dc-a71cf11512e5'
      buildId = '195b4a3f9e7-03e5be430a9e7796'
      this.req.query = {
        page,
        h,
        v,
        editorId,
        buildId,
        clsiserverid: clsiServerId,
      }

      imageName = 'foo/bar:tag-1'
      this.ProjectGetter.promises.getProject = sinon
        .stub()
        .resolves({ imageName })

      this.CompileController._proxyToClsi = sinon.stub()

      await this.CompileController.proxySyncPdf(this.req, this.res, this.next)
    })

    it('should parse the parameters', function () {
      expect(this.CompileManager.promises.syncTeX).to.have.been.calledWith(
        this.projectId,
        this.user_id,
        {
          direction: 'pdf',
          compileFromClsiCache: false,
          validatedOptions: {
            page,
            h,
            v,
            editorId,
            buildId,
          },
          clsiServerId,
        }
      )
    })
  })

  describe('_proxyToClsi', function () {
    beforeEach(function () {
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
        beforeEach(async function () {
          this.CompileManager.promises.getProjectCompileLimits = sinon
            .stub()
            .resolves({
              compileGroup: 'standard',
              compileBackendClass: 'n2d',
            })
          await this.CompileController._proxyToClsi(
            this.projectId,
            'output-file',
            (this.url = '/test'),
            { query: 'foo' },
            this.req,
            this.res,
            this.next
          )
        })

        it('should open a request to the CLSI', function () {
          this.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
            `${this.settings.apis.clsi.url}${this.url}?compileGroup=standard&compileBackendClass=n2d&query=foo`
          )
        })

        it('should pass the request on to the client', function () {
          this.pipeline.should.have.been.calledWith(this.clsiStream, this.res)
        })
      })

      describe('user with priority compile', function () {
        beforeEach(async function () {
          this.CompileManager.promises.getProjectCompileLimits = sinon
            .stub()
            .resolves({
              compileGroup: 'priority',
              compileBackendClass: 'c2d',
            })
          await this.CompileController._proxyToClsi(
            this.projectId,
            'output-file',
            (this.url = '/test'),
            {},
            this.req,
            this.res,
            this.next
          )
        })

        it('should open a request to the CLSI', function () {
          this.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
            `${this.settings.apis.clsi.url}${this.url}?compileGroup=priority&compileBackendClass=c2d`
          )
        })
      })

      describe('user with standard priority via query string', function () {
        beforeEach(async function () {
          this.req.query = { compileGroup: 'standard' }
          this.CompileManager.promises.getProjectCompileLimits = sinon
            .stub()
            .resolves({
              compileGroup: 'standard',
              compileBackendClass: 'n2d',
            })
          await this.CompileController._proxyToClsi(
            this.projectId,
            'output-file',
            (this.url = '/test'),
            {},
            this.req,
            this.res,
            this.next
          )
        })

        it('should open a request to the CLSI', function () {
          this.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
            `${this.settings.apis.clsi.url}${this.url}?compileGroup=standard&compileBackendClass=n2d`
          )
        })

        it('should pass the request on to the client', function () {
          this.pipeline.should.have.been.calledWith(this.clsiStream, this.res)
        })
      })

      describe('user with non-existent priority via query string', function () {
        beforeEach(async function () {
          this.req.query = { compileGroup: 'foobar' }
          this.CompileManager.promises.getProjectCompileLimits = sinon
            .stub()
            .resolves({
              compileGroup: 'standard',
              compileBackendClass: 'n2d',
            })
          await this.CompileController._proxyToClsi(
            this.projectId,
            'output-file',
            (this.url = '/test'),
            {},
            this.req,
            this.res,
            this.next
          )
        })

        it('should proxy to the standard url', function () {
          this.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
            `${this.settings.apis.clsi.url}${this.url}?compileGroup=standard&compileBackendClass=n2d`
          )
        })
      })

      describe('user with build parameter via query string', function () {
        beforeEach(async function () {
          this.CompileManager.promises.getProjectCompileLimits = sinon
            .stub()
            .resolves({
              compileGroup: 'standard',
              compileBackendClass: 'n2d',
            })
          this.req.query = { build: 1234 }
          await this.CompileController._proxyToClsi(
            this.projectId,
            'output-file',
            (this.url = '/test'),
            {},
            this.req,
            this.res,
            this.next
          )
        })

        it('should proxy to the standard url without the build parameter', function () {
          this.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
            `${this.settings.apis.clsi.url}${this.url}?compileGroup=standard&compileBackendClass=n2d`
          )
        })
      })
    })
  })

  describe('deleteAuxFiles', function () {
    beforeEach(async function () {
      this.CompileManager.promises.deleteAuxFiles = sinon.stub().resolves()
      this.req.params = { Project_id: this.projectId }
      this.req.query = { clsiserverid: 'node-1' }
      this.res.sendStatus = sinon.stub()
      await this.CompileController.deleteAuxFiles(this.req, this.res, this.next)
    })

    it('should proxy to the CLSI', function () {
      this.CompileManager.promises.deleteAuxFiles
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
      this.downloadPath = `/project/${this.projectId}/build/123/output/output.pdf`
      this.CompileManager.promises.compile.resolves({
        status: 'success',
        outputFiles: [{ path: 'output.pdf', url: this.downloadPath }],
      })
      this.CompileController._proxyToClsi = sinon.stub()
      this.res = { send: () => {}, sendStatus: sinon.stub() }
    })

    it('should call compile in the compile manager', async function () {
      await this.CompileController.compileAndDownloadPdf(this.req, this.res)
      this.CompileManager.promises.compile
        .calledWith(this.projectId)
        .should.equal(true)
    })

    it('should proxy the res to the clsi with correct url', async function () {
      await this.CompileController.compileAndDownloadPdf(this.req, this.res)
      sinon.assert.calledWith(
        this.CompileController._proxyToClsi,
        this.projectId,
        'output-file',
        this.downloadPath,
        {},
        this.req,
        this.res
      )

      this.CompileController._proxyToClsi
        .calledWith(
          this.projectId,
          'output-file',
          this.downloadPath,
          {},
          this.req,
          this.res
        )
        .should.equal(true)
    })

    it('should not download anything on compilation failures', async function () {
      this.CompileManager.promises.compile.rejects(new Error('failed'))
      await this.CompileController.compileAndDownloadPdf(
        this.req,
        this.res,
        this.next
      )
      this.res.sendStatus.should.have.been.calledWith(500)
      this.CompileController._proxyToClsi.should.not.have.been.called
    })

    it('should not download anything on missing pdf', async function () {
      this.CompileManager.promises.compile.resolves({
        status: 'success',
        outputFiles: [],
      })
      await this.CompileController.compileAndDownloadPdf(this.req, this.res)
      this.res.sendStatus.should.have.been.calledWith(500)
      this.CompileController._proxyToClsi.should.not.have.been.called
    })
  })

  describe('wordCount', function () {
    beforeEach(async function () {
      this.CompileManager.promises.wordCount = sinon
        .stub()
        .resolves({ content: 'body' })
      this.req.params = { Project_id: this.projectId }
      this.req.query = { clsiserverid: 'node-42' }
      this.res.json = sinon.stub()
      this.res.contentType = sinon.stub()
      await this.CompileController.wordCount(this.req, this.res, this.next)
    })

    it('should proxy to the CLSI', function () {
      this.CompileManager.promises.wordCount
        .calledWith(this.projectId, this.user_id, false, 'node-42')
        .should.equal(true)
    })

    it('should return a 200 and body', function () {
      this.res.json.calledWith({ content: 'body' }).should.equal(true)
    })
  })
})
