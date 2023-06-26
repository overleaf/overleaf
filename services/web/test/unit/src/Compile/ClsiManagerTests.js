const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/Compile/ClsiManager.js'
const SandboxedModule = require('sandboxed-module')
const tk = require('timekeeper')

const FILESTORE_URL = 'http://filestore.example.com'
const CLSI_URL = 'http://clsi.example.com'

describe('ClsiManager', function () {
  beforeEach(function () {
    this.jar = { cookie: 'stuff' }
    this.user_id = 'user-id'
    this.project = {
      _id: 'project-id',
      compiler: 'latex',
      rootDoc_id: 'mock-doc-id-1',
      imageName: 'mock-image-name',
    }
    this.docs = {
      '/main.tex': {
        name: 'main.tex',
        _id: 'mock-doc-id-1',
        lines: ['Hello', 'world'],
      },
      '/chapters/chapter1.tex': {
        name: 'chapter1.tex',
        _id: 'mock-doc-id-2',
        lines: ['Chapter 1'],
      },
    }
    this.files = {
      '/images/image.png': {
        name: 'image.png',
        _id: 'mock-file-id-1',
        created: new Date(),
      },
    }
    this.rawOutputFiles = {}
    this.response = { statusCode: 200 }
    this.responseBody = {
      compile: { status: 'success' },
    }

    this.request = sinon.stub().yields(null, this.response, this.responseBody)
    this.ClsiCookieManager = {
      clearServerId: sinon.stub().yields(),
      getCookieJar: sinon.stub().yields(null, this.jar),
      setServerId: sinon.stub().yields(null),
    }
    this.ClsiStateManager = {
      computeHash: sinon.stub().returns('01234567890abcdef'),
    }
    this.ClsiFormatChecker = {
      checkRecoursesForProblems: sinon.stub().yields(),
    }
    this.Project = {}
    this.ProjectEntityHandler = {
      getAllDocs: sinon.stub().yields(null, this.docs),
      getAllFiles: sinon.stub().yields(null, this.files),
      getAllDocPathsFromProject: sinon.stub(),
    }
    this.ProjectGetter = {
      findById: sinon.stub().yields(null, this.project),
      getProject: sinon.stub().yields(null, this.project),
    }
    this.DocumentUpdaterHandler = {
      clearProjectState: sinon.stub().yields(),
      flushProjectToMongo: sinon.stub().yields(),
      getProjectDocsIfMatch: sinon.stub().yields(),
    }
    this.Metrics = {
      Timer: class Metrics {
        constructor() {
          this.done = sinon.stub()
        }
      },
      inc: sinon.stub(),
      count: sinon.stub(),
    }
    this.SplitTestHandler = {
      getAssignment: sinon.stub().yields(null, { variant: 'default' }),
    }

    this.ClsiManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {
          apis: {
            filestore: {
              url: FILESTORE_URL,
              secret: 'secret',
            },
            clsi: {
              url: CLSI_URL,
              defaultBackendClass: 'e2',
            },
            clsi_priority: {
              url: 'https://clsipremium.example.com',
            },
          },
          enablePdfCaching: true,
        }),
        '../../models/Project': {
          Project: this.Project,
        },
        '../Project/ProjectEntityHandler': this.ProjectEntityHandler,
        '../Project/ProjectGetter': this.ProjectGetter,
        '../DocumentUpdater/DocumentUpdaterHandler':
          this.DocumentUpdaterHandler,
        './ClsiCookieManager': () => this.ClsiCookieManager,
        './ClsiStateManager': this.ClsiStateManager,
        request: this.request,
        './ClsiFormatChecker': this.ClsiFormatChecker,
        '@overleaf/metrics': this.Metrics,
        '../SplitTests/SplitTestHandler': this.SplitTestHandler,
      },
    })
    this.callback = sinon.stub()
    tk.freeze(Date.now())
  })

  after(function () {
    tk.reset()
  })

  describe('sendRequest', function () {
    beforeEach(function () {
      this.ClsiCookieManager.getCookieJar.yields(null, this.jar, 'clsi3')
    })

    describe('with a successful compile', function () {
      beforeEach(function (done) {
        this.outputFiles = [
          {
            url: `/project/${this.project_id}/user/${this.user_id}/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: 1234,
          },
          {
            url: `/project/${this.project_id}/user/${this.user_id}/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: 1234,
          },
        ]
        this.responseBody.compile.outputFiles = this.outputFiles.map(
          outputFile => ({ ...outputFile, url: CLSI_URL + outputFile.url })
        )
        this.timeout = 100
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          {
            compileBackendClass: 'e2',
            compileGroup: 'standard',
            timeout: this.timeout,
          },
          (err, status, outputFiles) => {
            if (err) {
              return done(err)
            }
            this.result = { status, outputFiles }
            done()
          }
        )
      })

      it('should send the request to the CLSI', function () {
        this.request.should.have.been.calledWith({
          url: `${CLSI_URL}/project/${this.project._id}/user/${this.user_id}/compile?compileBackendClass=e2&compileGroup=standard`,
          method: 'POST',
          json: {
            compile: {
              options: sinon.match({
                compiler: this.project.compiler,
                imageName: this.project.imageName,
                timeout: this.timeout,
                draft: false,
                check: undefined,
                syncType: undefined, // "full"
                syncState: undefined,
                compileGroup: 'standard',
                enablePdfCaching: false,
                pdfCachingMinChunkSize: undefined,
                flags: undefined,
                metricsMethod: 'standard',
                stopOnFirstError: false,
              }),
              rootResourcePath: 'main.tex',
              resources: _makeResources(this.project, this.docs, this.files),
            },
          },
          jar: this.jar,
        })
      })

      it('should get the project with the required fields', function () {
        this.ProjectGetter.getProject.should.have.been.calledWith(
          this.project._id,
          {
            compiler: 1,
            rootDoc_id: 1,
            imageName: 1,
            rootFolder: 1,
          }
        )
      })

      it('should flush the project to the database', function () {
        this.DocumentUpdaterHandler.flushProjectToMongo.should.have.been.calledWith(
          this.project._id
        )
      })

      it('should get all the docs', function () {
        this.ProjectEntityHandler.getAllDocs.should.have.been.calledWith(
          this.project._id
        )
      })

      it('should get all the files', function () {
        this.ProjectEntityHandler.getAllFiles.should.have.been.calledWith(
          this.project._id
        )
      })

      it('should call the callback with the status and output files', function () {
        expect(this.result.status).to.equal('success')
        expect(this.result.outputFiles.map(f => f.path)).to.have.members(
          this.outputFiles.map(f => f.path)
        )
      })

      it('should process a request with a cookie jar', function () {
        expect(this.request).to.have.been.calledWith(
          sinon.match(opts => opts.jar === this.jar && opts.qs == null)
        )
      })

      it('should persist the cookie from the response', function () {
        expect(this.ClsiCookieManager.setServerId).to.have.been.calledWith(
          this.project._id,
          this.user_id,
          'standard',
          'e2',
          this.response
        )
      })
    })

    describe('with ranges on the pdf and stats/timings details', function () {
      beforeEach(function (done) {
        this.ranges = [{ start: 1, end: 42, hash: 'foo' }]
        this.startXRefTable = 123
        this.size = 456
        this.contentId = '123-321'
        this.outputFiles = [
          {
            url: `/project/${this.project._id}/user/${this.user_id}/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: 1234,
            contentId: this.contentId,
            ranges: this.ranges,
            startXRefTable: this.startXRefTable,
            size: this.size,
          },
          {
            url: `/project/${this.project._id}/user/${this.user_id}/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: 1234,
          },
        ]
        this.stats = { fooStat: 1 }
        this.timings = { barTiming: 2 }
        this.serverId = 'clsi-server-id-42'
        this.responseBody.compile.outputFiles = this.outputFiles.map(
          outputFile => ({ ...outputFile, url: CLSI_URL + outputFile.url })
        )
        this.responseBody.compile.stats = this.stats
        this.responseBody.compile.timings = this.timings
        this.ClsiCookieManager.getCookieJar.yields(
          null,
          this.jar,
          this.serverId
        )
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          (
            err,
            status,
            outputFiles,
            serverId,
            validationError,
            stats,
            timings
          ) => {
            if (err) {
              return done(err)
            }
            this.result = {
              status,
              outputFiles,
              serverId,
              validationError,
              stats,
              timings,
            }
            done()
          }
        )
      })

      it('should emit the caching details and stats/timings', function () {
        expect(this.result.status).to.equal('success')
        expect(this.result.serverId).to.equal(this.serverId)
        expect(this.result.validationError).to.be.undefined
        expect(this.result.stats).to.equal(this.stats)
        expect(this.result.timings).to.equal(this.timings)
        const outputPdf = this.result.outputFiles.find(
          f => f.path === 'output.pdf'
        )
        expect(outputPdf.ranges).to.equal(this.ranges)
        expect(outputPdf.startXRefTable).to.equal(this.startXRefTable)
        expect(outputPdf.contentId).to.equal(this.contentId)
        expect(outputPdf.size).to.equal(this.size)
      })
    })

    describe('with the incremental compile option', function () {
      beforeEach(function (done) {
        const doc = this.docs['/main.tex']
        this.DocumentUpdaterHandler.getProjectDocsIfMatch.yields(null, [
          { _id: doc._id, lines: doc.lines, v: 123 },
        ])
        this.ProjectEntityHandler.getAllDocPathsFromProject.returns({
          'mock-doc-id-1': 'main.tex',
        })
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          {
            timeout: 100,
            incrementalCompilesEnabled: true,
            compileBackendClass: 'e2',
            compileGroup: 'priority',
            enablePdfCaching: true,
            pdfCachingMinChunkSize: 1337,
          },
          (err, status, outputFiles) => {
            if (err) {
              return done(err)
            }
            this.result = { status, outputFiles }
            done()
          }
        )
      })

      it('should get the project with the required fields', function () {
        this.ProjectGetter.getProject.should.have.been.calledWith(
          this.project._id,
          {
            compiler: 1,
            rootDoc_id: 1,
            imageName: 1,
            rootFolder: 1,
          }
        )
      })

      it('should not explicitly flush the project to the database', function () {
        this.DocumentUpdaterHandler.flushProjectToMongo.should.not.have.been.calledWith(
          this.project._id
        )
      })

      it('should get only the live docs from the docupdater with a background flush in docupdater', function () {
        this.DocumentUpdaterHandler.getProjectDocsIfMatch.should.have.been.calledWith(
          this.project._id
        )
      })

      it('should not get any of the files', function () {
        this.ProjectEntityHandler.getAllFiles.should.not.have.been.called
      })

      it('should build up the CLSI request', function () {
        this.request.should.have.been.calledWith({
          url: `${CLSI_URL}/project/${this.project._id}/user/${this.user_id}/compile?compileBackendClass=e2&compileGroup=priority`,
          method: 'POST',
          json: {
            compile: {
              options: {
                compiler: this.project.compiler,
                timeout: 100,
                imageName: this.project.imageName,
                draft: false,
                check: undefined,
                syncType: 'incremental',
                syncState: '01234567890abcdef',
                compileGroup: 'priority',
                enablePdfCaching: true,
                pdfCachingMinChunkSize: 1337,
                flags: undefined,
                metricsMethod: 'priority',
                stopOnFirstError: false,
              },
              rootResourcePath: 'main.tex',
              resources: [
                {
                  path: 'main.tex',
                  content: this.docs['/main.tex'].lines.join('\n'),
                },
              ],
            },
          },
          jar: this.jar,
        })
      })
    })

    describe('when the root doc is set and not in the docupdater', function () {
      beforeEach(function (done) {
        const doc = this.docs['/main.tex']
        this.DocumentUpdaterHandler.getProjectDocsIfMatch.yields(null, [
          { _id: doc._id, lines: doc.lines, v: 123 },
        ])
        this.ProjectEntityHandler.getAllDocPathsFromProject.returns({
          'mock-doc-id-1': 'main.tex',
          'mock-doc-id-2': '/chapters/chapter1.tex',
        })
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          {
            timeout: 100,
            incrementalCompilesEnabled: true,
            rootDoc_id: 'mock-doc-id-2',
          },
          done
        )
      })

      it('should still change the root path', function () {
        this.request.should.have.been.calledWith(
          sinon.match(
            opts =>
              opts.json.compile.rootResourcePath === 'chapters/chapter1.tex'
          )
        )
      })
    })

    describe('when root doc override is valid', function () {
      beforeEach(function (done) {
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          { rootDoc_id: 'mock-doc-id-2' },
          done
        )
      })

      it('should change root path', function () {
        this.request.should.have.been.calledWith(
          sinon.match(
            opts =>
              opts.json.compile.rootResourcePath === 'chapters/chapter1.tex'
          )
        )
      })
    })

    describe('when root doc override is invalid', function () {
      beforeEach(function (done) {
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          { rootDoc_id: 'invalid-id' },
          done
        )
      })

      it('should fallback to default root doc', function () {
        this.request.should.have.been.calledWith(
          sinon.match(opts => opts.json.compile.rootResourcePath === 'main.tex')
        )
      })
    })

    describe('when the project has an invalid compiler', function () {
      beforeEach(function (done) {
        this.project.compiler = 'context'
        this.ClsiManager.sendRequest(this.project._id, this.user_id, {}, done)
      })

      it('should set the compiler to pdflatex', function () {
        expect(this.request).to.have.been.calledWith(
          sinon.match(opts => opts.json.compile.options.compiler === 'pdflatex')
        )
      })
    })

    describe('when there is no valid root document', function () {
      beforeEach(function (done) {
        this.project.rootDoc_id = 'not-valid'
        this.ClsiManager.sendRequest(this.project._id, this.user_id, {}, done)
      })

      it('should set to main.tex', function () {
        expect(this.request).to.have.been.calledWith(
          sinon.match(opts => opts.json.compile.rootResourcePath === 'main.tex')
        )
      })
    })

    describe('when there is no valid root document and no main.tex document', function () {
      beforeEach(function (done) {
        this.project.rootDoc_id = 'not-valid'
        this.docs = {
          '/other.tex': {
            name: 'other.tex',
            _id: 'mock-doc-id-1',
            lines: ['Hello', 'world'],
          },
          '/chapters/chapter1.tex': {
            name: 'chapter1.tex',
            _id: 'mock-doc-id-2',
            lines: ['Chapter 1'],
          },
        }
        this.ProjectEntityHandler.getAllDocs.yields(null, this.docs)
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          {},
          (err, status) => {
            if (err) {
              return done(err)
            }
            this.result = { status }
            done()
          }
        )
      })

      it('should report a validation problem', function () {
        expect(this.result.status).to.equal('validation-problems')
      })
    })

    describe('when there is no valid root document and a single document which is not main.tex', function () {
      beforeEach(function (done) {
        this.project.rootDoc_id = 'not-valid'
        this.docs = {
          '/other.tex': {
            name: 'other.tex',
            _id: 'mock-doc-id-1',
            lines: ['Hello', 'world'],
          },
        }
        this.ProjectEntityHandler.getAllDocs.yields(null, this.docs)
        this.ClsiManager.sendRequest(this.project._id, this.user_id, {}, done)
      })

      it('should set io to the only file', function () {
        expect(this.request).to.have.been.calledWith(
          sinon.match(
            opts => opts.json.compile.rootResourcePath === 'other.tex'
          )
        )
      })
    })

    describe('with the draft option', function () {
      beforeEach(function (done) {
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          { timeout: 100, draft: true },
          done
        )
      })

      it('should add the draft option into the request', function () {
        expect(this.request).to.have.been.calledWith(
          sinon.match(opts => opts.json.compile.options.draft === true)
        )
      })
    })

    describe('with a failed compile', function () {
      beforeEach(function (done) {
        this.responseBody.compile.status = 'failure'
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          {},
          (err, status) => {
            if (err) {
              return done(err)
            }
            this.result = { status }
            done()
          }
        )
      })

      it('should call the callback with a failure status', function () {
        expect(this.result.status).to.equal('failure')
      })
    })

    describe('with a sync conflict', function () {
      beforeEach(function (done) {
        this.request
          .withArgs(
            sinon.match(opts => opts.json.compile.options.syncType !== 'full')
          )
          .yields(null, this.response, {
            compile: { status: 'conflict' },
          })
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          {},
          (err, status) => {
            if (err) {
              return done(err)
            }
            this.result = { status }
            done()
          }
        )
      })

      it('should send two requests to CLSI', function () {
        this.request.should.have.been.calledTwice
      })

      it('should call the CLSI first without syncType:full', function () {
        const compileOptions =
          this.request.getCall(0).args[0].json.compile.options
        expect(compileOptions.syncType).to.be.undefined
      })

      it('should call the CLSI a second time with syncType:full', function () {
        const compileOptions =
          this.request.getCall(1).args[0].json.compile.options
        expect(compileOptions.syncType).to.equal('full')
      })

      it('should call the callback with a success status', function () {
        this.result.status.should.equal('success')
      })
    })

    describe('with an unavailable response', function () {
      beforeEach(function (done) {
        this.request.onCall(0).yields(null, this.response, {
          compile: { status: 'unavailable' },
        })
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          {},
          (err, status) => {
            if (err) {
              return done(err)
            }
            this.result = { status }
            done()
          }
        )
      })

      it('should send two requests to CLSI', function () {
        this.request.should.have.been.calledTwice
      })

      it('should call the CLSI first without syncType:full', function () {
        const compileOptions =
          this.request.getCall(0).args[0].json.compile.options
        expect(compileOptions.syncType).to.be.undefined
      })

      it('should call the CLSI a second time with syncType:full', function () {
        const compileOptions =
          this.request.getCall(1).args[0].json.compile.options
        expect(compileOptions.syncType).to.equal('full')
      })

      it('should clear the CLSI server id cookie', function () {
        expect(this.ClsiCookieManager.clearServerId).to.have.been.calledWith(
          this.project._id,
          this.user_id
        )
      })

      it('should call the callback with a success status', function () {
        expect(this.result.status).to.equal('success')
      })
    })

    describe('when the resources fail the precompile check', function () {
      beforeEach(function () {
        this.ClsiFormatChecker.checkRecoursesForProblems.yields(
          new Error('failed')
        )
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          {},
          this.callback
        )
      })

      it('should call the callback only once', function () {
        this.callback.calledOnce.should.equal(true)
      })

      it('should call the callback with an error', function () {
        this.callback.should.have.been.calledWith(sinon.match.instanceOf(Error))
      })
    })

    describe('when a new backend is configured', function () {
      beforeEach(function (done) {
        this.settings.apis.clsi_new = { url: 'https://compiles.somewhere.test' }
        this.ClsiManager.sendRequest(
          this.project._id,
          this.user_id,
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          err => {
            if (err) {
              return done(err)
            }
            // wait for the background task to finish
            setTimeout(done, 0)
          }
        )
      })

      it('makes a request to the new backend', function () {
        expect(this.request).to.have.been.calledTwice
        expect(this.request).to.have.been.calledWith(
          sinon.match({
            url: `${CLSI_URL}/project/${this.project._id}/user/${this.user_id}/compile?compileBackendClass=e2&compileGroup=standard`,
          })
        )
        expect(this.request).to.have.been.calledWith(
          sinon.match({
            url: `${this.settings.apis.clsi_new.url}/project/${this.project._id}/user/${this.user_id}/compile?compileBackendClass=e2&compileGroup=standard`,
          })
        )
      })
    })
  })

  describe('sendExternalRequest', function () {
    beforeEach(function () {
      this.submissionId = 'submission-id'
      this.clsiRequest = 'mock-request'
      this.ClsiCookieManager.getCookieJar.yields(null, this.jar, 'clsi3')
    })

    describe('with a successful compile', function () {
      beforeEach(function (done) {
        this.outputFiles = [
          {
            url: `/project/${this.submissionId}/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: 1234,
          },
          {
            url: `/project/${this.submissionId}/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: 1234,
          },
        ]
        this.responseBody.compile.outputFiles = this.outputFiles.map(
          outputFile => ({ ...outputFile, url: CLSI_URL + outputFile.url })
        )
        this.ClsiManager.sendExternalRequest(
          this.submissionId,
          this.clsiRequest,
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          (err, status, outputFiles) => {
            if (err) {
              return done(err)
            }
            this.result = { status, outputFiles }
            done()
          }
        )
      })

      it('should send the request to the CLSI', function () {
        this.request.should.have.been.calledWith({
          url: `${CLSI_URL}/project/${this.submissionId}/compile?compileBackendClass=e2&compileGroup=standard`,
          method: 'POST',
          json: this.clsiRequest,
          jar: this.jar,
        })
      })

      it('should call the callback with the status and output files', function () {
        expect(this.result.status).to.equal('success')
        expect(this.result.outputFiles.map(f => f.path)).to.have.members(
          this.outputFiles.map(f => f.path)
        )
      })
    })

    describe('with a failed compile', function () {
      beforeEach(function (done) {
        this.responseBody.compile.status = 'failure'
        this.ClsiManager.sendExternalRequest(
          this.submissionId,
          this.clsiRequest,
          {},
          (err, status) => {
            if (err) {
              return done(err)
            }
            this.result = { status }
            done()
          }
        )
      })

      it('should call the callback with a failure status', function () {
        expect(this.result.status).to.equal('failure')
      })
    })

    describe('when the resources fail the precompile check', function () {
      beforeEach(function (done) {
        this.ClsiFormatChecker.checkRecoursesForProblems.yields(
          new Error('failed')
        )
        this.responseBody.compile.status = 'failure'
        this.ClsiManager.sendExternalRequest(
          this.submissionId,
          this.clsiRequest,
          {},
          err => {
            this.err = err
            done()
          }
        )
      })

      it('should call the callback with an error', function () {
        expect(this.err).to.be.instanceof(Error)
      })
    })
  })

  describe('deleteAuxFiles', function () {
    describe('with the standard compileGroup', function () {
      beforeEach(function (done) {
        this.ClsiManager.deleteAuxFiles(
          this.project._id,
          this.user_id,
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          'node-1',
          done
        )
      })

      it('should call the delete method in the standard CLSI', function () {
        this.request.should.have.been.calledWith({
          url: `${CLSI_URL}/project/${this.project._id}/user/${this.user_id}?compileBackendClass=e2&compileGroup=standard`,
          method: 'DELETE',
          qs: {
            compileGroup: 'standard',
            compileBackendClass: 'e2',
            clsiserverid: 'node-1',
          },
        })
      })

      it('should clear the project state from the docupdater', function () {
        this.DocumentUpdaterHandler.clearProjectState
          .calledWith(this.project._id)
          .should.equal(true)
      })

      it('should clear the clsi persistance', function () {
        this.ClsiCookieManager.clearServerId
          .calledWith(this.project._id, this.user_id)
          .should.equal(true)
      })

      it('should not add a cookie jar', function () {
        expect(this.request).to.have.been.calledWith(
          sinon.match(opts => opts.jar == null)
        )
      })

      it('should not persist a cookie on response', function () {
        expect(this.ClsiCookieManager.setServerId).not.to.have.been.called
      })
    })
  })

  describe('wordCount', function () {
    describe('with root file', function () {
      beforeEach(function (done) {
        this.ClsiManager.wordCount(
          this.project._id,
          this.user_id,
          false,
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          'node-1',
          done
        )
      })

      it('should call wordCount with root file', function () {
        expect(this.request).to.have.been.calledWith({
          url: `http://clsi.example.com/project/${this.project._id}/user/${this.user_id}/wordcount?compileBackendClass=e2&compileGroup=standard`,
          method: 'GET',
          qs: {
            compileGroup: 'standard',
            compileBackendClass: 'e2',
            clsiserverid: 'node-1',
            file: 'main.tex',
            image: 'mock-image-name',
          },
          json: true,
        })
      })

      it('should not persist a cookie on response', function () {
        expect(this.ClsiCookieManager.setServerId).not.to.have.been.called
      })
    })

    describe('with param file', function () {
      beforeEach(function (done) {
        this.ClsiManager.wordCount(
          this.project._id,
          this.user_id,
          'other.tex',
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          'node-2',
          done
        )
      })

      it('should call wordCount with param file', function () {
        expect(this.request).to.have.been.calledWith({
          url: `http://clsi.example.com/project/${this.project._id}/user/${this.user_id}/wordcount?compileBackendClass=e2&compileGroup=standard`,
          method: 'GET',
          qs: {
            compileGroup: 'standard',
            compileBackendClass: 'e2',
            clsiserverid: 'node-2',
            file: 'other.tex',
            image: 'mock-image-name',
          },
          json: true,
        })
      })

      it('should not persist a cookie on response', function () {
        expect(this.ClsiCookieManager.setServerId).not.to.have.been.called
      })
    })
  })
})

function _makeResources(project, docs, files) {
  const resources = []
  for (const [path, doc] of Object.entries(docs)) {
    resources.push({
      path: path.replace(/^\//, ''),
      content: doc.lines.join('\n'),
    })
  }
  for (const [path, file] of Object.entries(files)) {
    resources.push({
      path: path.replace(/^\//, ''),
      url: `${FILESTORE_URL}/project/${project._id}/file/${file._id}`,
      modified: file.created.getTime(),
    })
  }
  return resources
}
