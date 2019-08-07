/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { assert } = require('chai')
const { expect } = chai
const modulePath = '../../../../app/src/Features/Compile/CompileController.js'
const SandboxedModule = require('sandboxed-module')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')

describe('CompileController', function() {
  beforeEach(function() {
    this.user_id = 'wat'
    this.user = {
      _id: this.user_id,
      email: 'user@example.com',
      features: {
        compileGroup: 'premium',
        compileTimeout: 100
      }
    }
    this.CompileManager = { compile: sinon.stub() }
    this.ClsiManager = {}
    this.UserGetter = { getUser: sinon.stub() }
    this.RateLimiter = { addCount: sinon.stub() }
    this.settings = {
      apis: {
        clsi: {
          url: 'clsi.example.com'
        },
        clsi_priority: {
          url: 'clsi-priority.example.com'
        }
      },
      defaultFeatures: {
        compileGroup: 'standard',
        compileTimeout: 60
      }
    }
    this.jar = { cookie: 'stuff' }
    this.ClsiCookieManager = {
      getCookieJar: sinon.stub().callsArgWith(1, null, this.jar)
    }
    this.AuthenticationController = {
      getLoggedInUser: sinon.stub().callsArgWith(1, null, this.user),
      getLoggedInUserId: sinon.stub().returns(this.user_id),
      getSessionUser: sinon.stub().returns(this.user),
      isUserLoggedIn: sinon.stub().returns(true)
    }
    this.CompileController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        request: (this.request = sinon.stub()),
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub()
        }),
        'metrics-sharelatex': (this.Metrics = { inc: sinon.stub() }),
        './CompileManager': this.CompileManager,
        '../User/UserGetter': this.UserGetter,
        './ClsiManager': this.ClsiManager,
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        '../../infrastructure/RateLimiter': this.RateLimiter,
        './ClsiCookieManager': () => this.ClsiCookieManager
      }
    })
    this.project_id = 'project-id'
    this.next = sinon.stub()
    this.req = new MockRequest()
    return (this.res = new MockResponse())
  })

  describe('compile', function() {
    beforeEach(function() {
      this.req.params = { Project_id: this.project_id }
      this.req.session = {}
      return (this.CompileManager.compile = sinon
        .stub()
        .callsArgWith(
          3,
          null,
          (this.status = 'success'),
          (this.outputFiles = ['mock-output-files'])
        ))
    })

    describe('when not an auto compile', function() {
      beforeEach(function() {
        return this.CompileController.compile(this.req, this.res, this.next)
      })

      it('should look up the user id', function() {
        return this.AuthenticationController.getLoggedInUserId
          .calledWith(this.req)
          .should.equal(true)
      })

      it('should do the compile without the auto compile flag', function() {
        return this.CompileManager.compile
          .calledWith(this.project_id, this.user_id, { isAutoCompile: false })
          .should.equal(true)
      })

      it('should set the content-type of the response to application/json', function() {
        return this.res.contentType
          .calledWith('application/json')
          .should.equal(true)
      })

      it('should send a successful response reporting the status and files', function() {
        this.res.statusCode.should.equal(200)
        return this.res.body.should.equal(
          JSON.stringify({
            status: this.status,
            outputFiles: this.outputFiles
          })
        )
      })
    })

    describe('when an auto compile', function() {
      beforeEach(function() {
        this.req.query = { auto_compile: 'true' }
        return this.CompileController.compile(this.req, this.res, this.next)
      })

      it('should do the compile with the auto compile flag', function() {
        return this.CompileManager.compile
          .calledWith(this.project_id, this.user_id, { isAutoCompile: true })
          .should.equal(true)
      })
    })

    describe('with the draft attribute', function() {
      beforeEach(function() {
        this.req.body = { draft: true }
        return this.CompileController.compile(this.req, this.res, this.next)
      })

      it('should do the compile without the draft compile flag', function() {
        return this.CompileManager.compile
          .calledWith(this.project_id, this.user_id, {
            isAutoCompile: false,
            draft: true
          })
          .should.equal(true)
      })
    })
  })

  describe('compileSubmission', function() {
    beforeEach(function() {
      this.submission_id = 'sub-1234'
      this.req.params = { submission_id: this.submission_id }
      this.req.body = {}
      return (this.ClsiManager.sendExternalRequest = sinon
        .stub()
        .callsArgWith(
          3,
          null,
          (this.status = 'success'),
          (this.outputFiles = ['mock-output-files']),
          (this.clsiServerId = 'mock-server-id'),
          (this.validationProblems = null)
        ))
    })

    it('should set the content-type of the response to application/json', function() {
      this.CompileController.compileSubmission(this.req, this.res, this.next)
      return this.res.contentType
        .calledWith('application/json')
        .should.equal(true)
    })

    it('should send a successful response reporting the status and files', function() {
      this.CompileController.compileSubmission(this.req, this.res, this.next)
      this.res.statusCode.should.equal(200)
      return this.res.body.should.equal(
        JSON.stringify({
          status: this.status,
          outputFiles: this.outputFiles,
          clsiServerId: 'mock-server-id',
          validationProblems: null
        })
      )
    })

    describe('with compileGroup and timeout', function() {
      beforeEach(function() {
        this.req.body = {
          compileGroup: 'special',
          timeout: 600
        }
        return this.CompileController.compileSubmission(
          this.req,
          this.res,
          this.next
        )
      })

      it('should use the supplied values', function() {
        return this.ClsiManager.sendExternalRequest
          .calledWith(
            this.submission_id,
            { compileGroup: 'special', timeout: 600 },
            { compileGroup: 'special', timeout: 600 }
          )
          .should.equal(true)
      })
    })

    describe('with other supported options but not compileGroup and timeout', function() {
      beforeEach(function() {
        this.req.body = {
          rootResourcePath: 'main.tex',
          compiler: 'lualatex',
          draft: true,
          check: 'validate'
        }
        return this.CompileController.compileSubmission(
          this.req,
          this.res,
          this.next
        )
      })

      it('should use the other options but default values for compileGroup and timeout', function() {
        return this.ClsiManager.sendExternalRequest
          .calledWith(
            this.submission_id,
            {
              rootResourcePath: 'main.tex',
              compiler: 'lualatex',
              draft: true,
              check: 'validate'
            },
            {
              rootResourcePath: 'main.tex',
              compiler: 'lualatex',
              draft: true,
              check: 'validate',
              compileGroup: 'standard',
              timeout: 60
            }
          )
          .should.equal(true)
      })
    })
  })

  describe('downloadPdf', function() {
    beforeEach(function() {
      this.req.params = { Project_id: this.project_id }

      this.req.query = { pdfng: true }
      this.project = { name: 'test namè' }
      return (this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, this.project))
    })

    describe('when downloading for embedding', function() {
      beforeEach(function() {
        this.CompileController.proxyToClsi = sinon.stub()
        this.RateLimiter.addCount.callsArgWith(1, null, true)
        return this.CompileController.downloadPdf(this.req, this.res, this.next)
      })

      it('should look up the project', function() {
        return this.ProjectGetter.getProject
          .calledWith(this.project_id, { name: 1 })
          .should.equal(true)
      })

      it('should set the content-type of the response to application/pdf', function() {
        return this.res.contentType
          .calledWith('application/pdf')
          .should.equal(true)
      })

      it('should set the content-disposition header with a safe version of the project name', function() {
        return this.res.setContentDisposition
          .calledWith('', { filename: 'test_nam_.pdf' })
          .should.equal(true)
      })

      it('should increment the pdf-downloads metric', function() {
        return this.Metrics.inc.calledWith('pdf-downloads').should.equal(true)
      })

      it('should proxy the PDF from the CLSI', function() {
        return this.CompileController.proxyToClsi
          .calledWith(
            this.project_id,
            `/project/${this.project_id}/user/${
              this.user_id
            }/output/output.pdf`,
            this.req,
            this.res,
            this.next
          )
          .should.equal(true)
      })
    })

    describe('when the a build-id is provided', function() {
      beforeEach(function() {
        this.req.params.build_id = this.buildId = '1234-5678'
        this.CompileController.proxyToClsi = sinon.stub()
        this.RateLimiter.addCount.callsArgWith(1, null, true)
        return this.CompileController.downloadPdf(this.req, this.res, this.next)
      })

      it('should proxy the PDF from the CLSI, with a build-id', function() {
        return this.CompileController.proxyToClsi
          .calledWith(
            this.project_id,
            `/project/${this.project_id}/user/${this.user_id}/build/${
              this.buildId
            }/output/output.pdf`,
            this.req,
            this.res,
            this.next
          )
          .should.equal(true)
      })
    })

    describe('when the pdf is not going to be used in pdfjs viewer', function() {
      it('should check the rate limiter when pdfng is not set', function(done) {
        this.req.query = {}
        this.RateLimiter.addCount.callsArgWith(1, null, true)
        this.CompileController.proxyToClsi = (project_id, url) => {
          this.RateLimiter.addCount.args[0][0].throttle.should.equal(1000)
          return done()
        }
        return this.CompileController.downloadPdf(this.req, this.res)
      })

      it('should check the rate limiter when pdfng is false', function(done) {
        this.req.query = { pdfng: false }
        this.RateLimiter.addCount.callsArgWith(1, null, true)
        this.CompileController.proxyToClsi = (project_id, url) => {
          this.RateLimiter.addCount.args[0][0].throttle.should.equal(1000)
          return done()
        }
        return this.CompileController.downloadPdf(this.req, this.res)
      })
    })
  })

  describe('getFileFromClsiWithoutUser', function() {
    beforeEach(function() {
      this.submission_id = 'sub-1234'
      this.build_id = 123456
      this.file = 'project.pdf'
      this.req.params = {
        submission_id: this.submission_id,
        build_id: this.build_id,
        file: this.file
      }
      this.req.body = {}
      this.expected_url = `/project/${this.submission_id}/build/${
        this.build_id
      }/output/${this.file}`
      return (this.CompileController.proxyToClsiWithLimits = sinon.stub())
    })

    describe('without limits specified', function() {
      beforeEach(function() {
        return this.CompileController.getFileFromClsiWithoutUser(
          this.req,
          this.res,
          this.next
        )
      })

      it('should proxy to CLSI with correct URL and default limits', function() {
        return this.CompileController.proxyToClsiWithLimits
          .calledWith(this.submission_id, this.expected_url, {
            compileGroup: 'standard'
          })
          .should.equal(true)
      })
    })

    describe('with limits specified', function() {
      beforeEach(function() {
        this.req.body = { compileTimeout: 600, compileGroup: 'special' }
        return this.CompileController.getFileFromClsiWithoutUser(
          this.req,
          this.res,
          this.next
        )
      })

      it('should proxy to CLSI with correct URL and specified limits', function() {
        return this.CompileController.proxyToClsiWithLimits
          .calledWith(this.submission_id, this.expected_url, {
            compileGroup: 'special'
          })
          .should.equal(true)
      })
    })
  })

  describe('proxyToClsi', function() {
    beforeEach(function() {
      this.request.returns(
        (this.proxy = {
          pipe: sinon.stub(),
          on: sinon.stub()
        })
      )
      this.upstream = {
        statusCode: 204,
        headers: { mock: 'header' }
      }
      this.req.method = 'mock-method'
      return (this.req.headers = {
        Mock: 'Headers',
        Range: '123-456',
        'If-Range': 'abcdef',
        'If-Modified-Since': 'Mon, 15 Dec 2014 15:23:56 GMT'
      })
    })

    describe('old pdf viewer', function() {
      describe('user with standard priority', function() {
        beforeEach(function() {
          this.CompileManager.getProjectCompileLimits = sinon
            .stub()
            .callsArgWith(1, null, { compileGroup: 'standard' })
          return this.CompileController.proxyToClsi(
            this.project_id,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })

        it('should open a request to the CLSI', function() {
          return this.request
            .calledWith({
              jar: this.jar,
              method: this.req.method,
              url: `${this.settings.apis.clsi.url}${this.url}`,
              timeout: 60 * 1000
            })
            .should.equal(true)
        })

        it('should pass the request on to the client', function() {
          return this.proxy.pipe.calledWith(this.res).should.equal(true)
        })

        it('should bind an error handle to the request proxy', function() {
          return this.proxy.on.calledWith('error').should.equal(true)
        })
      })

      describe('user with priority compile', function() {
        beforeEach(function() {
          this.CompileManager.getProjectCompileLimits = sinon
            .stub()
            .callsArgWith(1, null, { compileGroup: 'priority' })
          return this.CompileController.proxyToClsi(
            this.project_id,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })
      })

      describe('user with standard priority via query string', function() {
        beforeEach(function() {
          this.req.query = { compileGroup: 'standard' }
          return this.CompileController.proxyToClsi(
            this.project_id,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })

        it('should open a request to the CLSI', function() {
          return this.request
            .calledWith({
              jar: this.jar,
              method: this.req.method,
              url: `${this.settings.apis.clsi.url}${this.url}`,
              timeout: 60 * 1000
            })
            .should.equal(true)
        })

        it('should pass the request on to the client', function() {
          return this.proxy.pipe.calledWith(this.res).should.equal(true)
        })

        it('should bind an error handle to the request proxy', function() {
          return this.proxy.on.calledWith('error').should.equal(true)
        })
      })

      describe('user with non-existent priority via query string', function() {
        beforeEach(function() {
          this.req.query = { compileGroup: 'foobar' }
          return this.CompileController.proxyToClsi(
            this.project_id,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })

        it('should proxy to the standard url', function() {
          return this.request
            .calledWith({
              jar: this.jar,
              method: this.req.method,
              url: `${this.settings.apis.clsi.url}${this.url}`,
              timeout: 60 * 1000
            })
            .should.equal(true)
        })
      })

      describe('user with build parameter via query string', function() {
        beforeEach(function() {
          this.CompileManager.getProjectCompileLimits = sinon
            .stub()
            .callsArgWith(1, null, { compileGroup: 'standard' })
          this.req.query = { build: 1234 }
          return this.CompileController.proxyToClsi(
            this.project_id,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })

        it('should proxy to the standard url without the build parameter', function() {
          return this.request
            .calledWith({
              jar: this.jar,
              method: this.req.method,
              url: `${this.settings.apis.clsi.url}${this.url}`,
              timeout: 60 * 1000
            })
            .should.equal(true)
        })
      })
    })

    describe('new pdf viewer', function() {
      beforeEach(function() {
        return (this.req.query = { pdfng: true })
      })
      describe('user with standard priority', function() {
        beforeEach(function() {
          this.CompileManager.getProjectCompileLimits = sinon
            .stub()
            .callsArgWith(1, null, { compileGroup: 'standard' })
          return this.CompileController.proxyToClsi(
            this.project_id,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })

        it('should open a request to the CLSI', function() {
          return this.request
            .calledWith({
              jar: this.jar,
              method: this.req.method,
              url: `${this.settings.apis.clsi.url}${this.url}`,
              timeout: 60 * 1000,
              headers: {
                Range: '123-456',
                'If-Range': 'abcdef',
                'If-Modified-Since': 'Mon, 15 Dec 2014 15:23:56 GMT'
              }
            })
            .should.equal(true)
        })

        it('should pass the request on to the client', function() {
          return this.proxy.pipe.calledWith(this.res).should.equal(true)
        })

        it('should bind an error handle to the request proxy', function() {
          return this.proxy.on.calledWith('error').should.equal(true)
        })
      })

      describe('user with build parameter via query string', function() {
        beforeEach(function() {
          this.CompileManager.getProjectCompileLimits = sinon
            .stub()
            .callsArgWith(1, null, { compileGroup: 'standard' })
          this.req.query = { build: 1234, pdfng: true }
          return this.CompileController.proxyToClsi(
            this.project_id,
            (this.url = '/test'),
            this.req,
            this.res,
            this.next
          )
        })

        it('should proxy to the standard url with the build parameter', function() {
          return this.request
            .calledWith({
              jar: this.jar,
              method: this.req.method,
              qs: { build: 1234 },
              url: `${this.settings.apis.clsi.url}${this.url}`,
              timeout: 60 * 1000,
              headers: {
                Range: '123-456',
                'If-Range': 'abcdef',
                'If-Modified-Since': 'Mon, 15 Dec 2014 15:23:56 GMT'
              }
            })
            .should.equal(true)
        })
      })
    })
  })

  describe('deleteAuxFiles', function() {
    beforeEach(function() {
      this.CompileManager.deleteAuxFiles = sinon.stub().callsArg(2)
      this.req.params = { Project_id: this.project_id }
      this.res.sendStatus = sinon.stub()
      return this.CompileController.deleteAuxFiles(
        this.req,
        this.res,
        this.next
      )
    })

    it('should proxy to the CLSI', function() {
      return this.CompileManager.deleteAuxFiles
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should return a 200', function() {
      return this.res.sendStatus.calledWith(200).should.equal(true)
    })
  })

  describe('compileAndDownloadPdf', function() {
    beforeEach(function() {
      this.req = {
        params: {
          project_id: this.project_id
        }
      }
      this.CompileManager.compile.callsArgWith(3)
      this.CompileController.proxyToClsi = sinon.stub()
      return (this.res = { send: () => {} })
    })

    it('should call compile in the compile manager', function(done) {
      this.CompileController.compileAndDownloadPdf(this.req, this.res)
      this.CompileManager.compile.calledWith(this.project_id).should.equal(true)
      return done()
    })

    it('should proxy the res to the clsi with correct url', function(done) {
      this.CompileController.compileAndDownloadPdf(this.req, this.res)
      sinon.assert.calledWith(
        this.CompileController.proxyToClsi,
        this.project_id,
        `/project/${this.project_id}/output/output.pdf`,
        this.req,
        this.res
      )

      this.CompileController.proxyToClsi
        .calledWith(
          this.project_id,
          `/project/${this.project_id}/output/output.pdf`,
          this.req,
          this.res
        )
        .should.equal(true)
      return done()
    })
  })

  describe('wordCount', function() {
    beforeEach(function() {
      this.CompileManager.wordCount = sinon
        .stub()
        .callsArgWith(3, null, { content: 'body' })
      this.req.params = { Project_id: this.project_id }
      this.res.send = sinon.stub()
      this.res.contentType = sinon.stub()
      return this.CompileController.wordCount(this.req, this.res, this.next)
    })

    it('should proxy to the CLSI', function() {
      return this.CompileManager.wordCount
        .calledWith(this.project_id, this.user_id, false)
        .should.equal(true)
    })

    it('should return a 200 and body', function() {
      return this.res.send.calledWith({ content: 'body' }).should.equal(true)
    })
  })
})
