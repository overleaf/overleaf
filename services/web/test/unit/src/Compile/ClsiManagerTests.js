const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/Compile/ClsiManager.js'
const SandboxedModule = require('sandboxed-module')
const tk = require('timekeeper')

describe('ClsiManager', function () {
  beforeEach(function () {
    this.jar = { cookie: 'stuff' }
    this.ClsiCookieManager = {
      clearServerId: sinon.stub().yields(),
      getCookieJar: sinon.stub().yields(null, this.jar),
      setServerId: sinon.stub().yields(null),
      _getServerId: sinon.stub(),
    }
    this.ClsiStateManager = {
      computeHash: sinon.stub().returns('01234567890abcdef'),
    }
    this.ClsiFormatChecker = {
      checkRecoursesForProblems: sinon.stub().callsArgWith(1),
    }
    this.Project = {}
    this.ProjectEntityHandler = {}
    this.ProjectGetter = {}
    this.DocumentUpdaterHandler = {
      getProjectDocsIfMatch: sinon.stub().callsArgWith(2, null, null),
    }
    this.request = sinon.stub()
    this.Metrics = {
      Timer: class Metrics {
        constructor() {
          this.done = sinon.stub()
        }
      },
      inc: sinon.stub(),
      count: sinon.stub(),
    }
    this.ClsiManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {
          apis: {
            filestore: {
              url: 'filestore.example.com',
              secret: 'secret',
            },
            clsi: {
              url: 'http://clsi.example.com',
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
        '../SplitTests/SplitTestHandler': {
          getAssignment: (this.getAssignment = sinon.stub().yields(null, {
            variant: 'default',
          })),
        },
      },
    })
    this.project_id = 'project-id'
    this.user_id = 'user-id'
    this.callback = sinon.stub()
    tk.freeze(Date.now())
  })

  after(function () {
    tk.reset()
  })

  describe('sendRequest', function () {
    beforeEach(function () {
      this.ClsiManager._buildRequest = sinon
        .stub()
        .callsArgWith(2, null, (this.request = 'mock-request'))
      this.ClsiCookieManager._getServerId.callsArgWith(2, null, 'clsi3')
    })

    describe('with a successful compile', function () {
      beforeEach(function () {
        this.ClsiManager._postToClsi = sinon.stub().yields(null, {
          compile: {
            status: (this.status = 'success'),
            outputFiles: [
              {
                url: `${this.settings.apis.clsi.url}/project/${this.project_id}/user/${this.user_id}/build/1234/output/output.pdf`,
                path: 'output.pdf',
                type: 'pdf',
                build: 1234,
              },
              {
                url: `${this.settings.apis.clsi.url}/project/${this.project_id}/user/${this.user_id}/build/1234/output/output.log`,
                path: 'output.log',
                type: 'log',
                build: 1234,
              },
            ],
          },
        })
        this.ClsiManager.sendRequest(
          this.project_id,
          this.user_id,
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          this.callback
        )
      })

      it('should build the request', function () {
        this.ClsiManager._buildRequest
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should send the request to the CLSI', function () {
        this.ClsiManager._postToClsi
          .calledWith(
            this.project_id,
            this.user_id,
            this.request,
            'e2',
            'standard'
          )
          .should.equal(true)
      })

      it('should call the callback with the status and output files', function () {
        const outputFiles = [
          {
            url: `/project/${this.project_id}/user/${this.user_id}/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: 1234,
            ranges: [],
            createdAt: new Date(),
            // gets dropped by JSON.stringify
            contentId: undefined,
            size: undefined,
            startXRefTable: undefined,
          },
          {
            url: `/project/${this.project_id}/user/${this.user_id}/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: 1234,
          },
        ]
        this.callback
          .calledWith(null, this.status, outputFiles)
          .should.equal(true)
      })
    })

    describe('with ranges on the pdf and stats/timings details', function () {
      beforeEach(function () {
        this.ClsiManager._postToClsi = sinon.stub().yields(
          null,
          {
            compile: {
              status: 'success',
              stats: { fooStat: 1 },
              timings: { barTiming: 2 },
              outputFiles: [
                {
                  url: `${this.settings.apis.clsi.url}/project/${this.project_id}/user/${this.user_id}/build/1234/output/output.pdf`,
                  path: 'output.pdf',
                  type: 'pdf',
                  build: 1234,
                  contentId: '123-321',
                  ranges: [{ start: 1, end: 42, hash: 'foo' }],
                  startXRefTable: 42,
                  size: 42,
                },
                {
                  url: `${this.settings.apis.clsi.url}/project/${this.project_id}/user/${this.user_id}/build/1234/output/output.log`,
                  path: 'output.log',
                  type: 'log',
                  build: 1234,
                },
              ],
            },
          },
          'clsi-server-id-43'
        )
        this.ClsiCookieManager._getServerId.yields(null, 'clsi-server-id-42')
        this.ClsiManager.sendRequest(
          this.project_id,
          this.user_id,
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          this.callback
        )
      })

      it('should emit the caching details and stats/timings', function () {
        const outputFiles = [
          {
            url: `/project/${this.project_id}/user/${this.user_id}/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: 1234,
            contentId: '123-321',
            ranges: [{ start: 1, end: 42, hash: 'foo' }],
            startXRefTable: 42,
            size: 42,
            createdAt: new Date(),
          },
          {
            url: `/project/${this.project_id}/user/${this.user_id}/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: 1234,
          },
        ]
        const validationError = undefined
        expect(this.callback).to.have.been.calledWith(
          null,
          'success',
          outputFiles,
          'clsi-server-id-43',
          validationError,
          { fooStat: 1 },
          { barTiming: 2 }
        )
      })
    })

    describe('with a failed compile', function () {
      beforeEach(function () {
        this.ClsiManager._postToClsi = sinon.stub().yields(null, {
          compile: {
            status: (this.status = 'failure'),
          },
        })
        this.ClsiManager.sendRequest(
          this.project_id,
          this.user_id,
          {},
          this.callback
        )
      })

      it('should call the callback with a failure status', function () {
        this.callback.calledWith(null, this.status).should.equal(true)
      })
    })

    describe('with a sync conflict', function () {
      beforeEach(function () {
        this.ClsiManager.sendRequestOnce = sinon.stub()
        this.ClsiManager.sendRequestOnce
          .withArgs(this.project_id, this.user_id, { syncType: 'full' })
          .callsArgWith(3, null, (this.status = 'success'))
        this.ClsiManager.sendRequestOnce
          .withArgs(this.project_id, this.user_id, {})
          .callsArgWith(3, null, 'conflict')
        this.ClsiManager.sendRequest(
          this.project_id,
          this.user_id,
          {},
          this.callback
        )
      })

      it('should call the sendRequestOnce method twice', function () {
        this.ClsiManager.sendRequestOnce.calledTwice.should.equal(true)
      })

      it('should call the sendRequestOnce method with syncType:full', function () {
        this.ClsiManager.sendRequestOnce
          .calledWith(this.project_id, this.user_id, { syncType: 'full' })
          .should.equal(true)
      })

      it('should call the sendRequestOnce method without syncType:full', function () {
        this.ClsiManager.sendRequestOnce
          .calledWith(this.project_id, this.user_id, {})
          .should.equal(true)
      })

      it('should call the callback with a success status', function () {
        this.callback.calledWith(null, this.status).should.equal(true)
      })
    })

    describe('with an unavailable response', function () {
      beforeEach(function () {
        this.ClsiManager.sendRequestOnce = sinon.stub()
        this.ClsiManager.sendRequestOnce
          .withArgs(this.project_id, this.user_id, {
            syncType: 'full',
            forceNewClsiServer: true,
          })
          .callsArgWith(3, null, (this.status = 'success'))
        this.ClsiManager.sendRequestOnce
          .withArgs(this.project_id, this.user_id, {})
          .callsArgWith(3, null, 'unavailable')
        this.ClsiManager.sendRequest(
          this.project_id,
          this.user_id,
          {},
          this.callback
        )
      })

      it('should call the sendRequestOnce method twice', function () {
        this.ClsiManager.sendRequestOnce.calledTwice.should.equal(true)
      })

      it('should call the sendRequestOnce method with forceNewClsiServer:true', function () {
        this.ClsiManager.sendRequestOnce
          .calledWith(this.project_id, this.user_id, {
            forceNewClsiServer: true,
            syncType: 'full',
          })
          .should.equal(true)
      })

      it('should call the sendRequestOnce method without forceNewClsiServer:true', function () {
        this.ClsiManager.sendRequestOnce
          .calledWith(this.project_id, this.user_id, {})
          .should.equal(true)
      })

      it('should call the callback with a success status', function () {
        this.callback.calledWith(null, this.status).should.equal(true)
      })
    })

    describe('when the resources fail the precompile check', function () {
      beforeEach(function () {
        this.ClsiFormatChecker.checkRecoursesForProblems = sinon
          .stub()
          .callsArgWith(1, new Error('failed'))
        this.ClsiManager._postToClsi = sinon.stub().yields(null, {
          compile: {
            status: (this.status = 'failure'),
          },
        })
        this.ClsiManager.sendRequest(
          this.project_id,
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
  })

  describe('sendExternalRequest', function () {
    beforeEach(function () {
      this.submission_id = 'submission-id'
      this.clsi_request = 'mock-request'
      this.ClsiCookieManager._getServerId.callsArgWith(2, null, 'clsi3')
    })

    describe('with a successful compile', function () {
      beforeEach(function () {
        this.ClsiManager._postToClsi = sinon.stub().yields(null, {
          compile: {
            status: (this.status = 'success'),
            outputFiles: [
              {
                url: `${this.settings.apis.clsi.url}/project/${this.submission_id}/build/1234/output/output.pdf`,
                path: 'output.pdf',
                type: 'pdf',
                build: 1234,
              },
              {
                url: `${this.settings.apis.clsi.url}/project/${this.submission_id}/build/1234/output/output.log`,
                path: 'output.log',
                type: 'log',
                build: 1234,
              },
            ],
          },
        })
        this.ClsiManager.sendExternalRequest(
          this.submission_id,
          this.clsi_request,
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          this.callback
        )
      })

      it('should send the request to the CLSI', function () {
        this.ClsiManager._postToClsi
          .calledWith(
            this.submission_id,
            null,
            this.clsi_request,
            'e2',
            'standard'
          )
          .should.equal(true)
      })

      it('should call the callback with the status and output files', function () {
        const outputFiles = [
          {
            url: `/project/${this.submission_id}/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: 1234,
            ranges: [],
            createdAt: new Date(),
            // gets dropped by JSON.stringify
            contentId: undefined,
            size: undefined,
            startXRefTable: undefined,
          },
          {
            url: `/project/${this.submission_id}/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: 1234,
          },
        ]
        this.callback.should.have.been.calledWith(
          null,
          this.status,
          outputFiles
        )
      })
    })

    describe('with a failed compile', function () {
      beforeEach(function () {
        this.ClsiManager._postToClsi = sinon.stub().yields(null, {
          compile: {
            status: (this.status = 'failure'),
          },
        })
        this.ClsiManager.sendExternalRequest(
          this.submission_id,
          this.clsi_request,
          {},
          this.callback
        )
      })

      it('should call the callback with a failure status', function () {
        this.callback.calledWith(null, this.status).should.equal(true)
      })
    })

    describe('when the resources fail the precompile check', function () {
      beforeEach(function () {
        this.ClsiFormatChecker.checkRecoursesForProblems = sinon
          .stub()
          .callsArgWith(1, new Error('failed'))
        this.ClsiManager._postToClsi = sinon.stub().yields(null, {
          compile: {
            status: (this.status = 'failure'),
          },
        })
        this.ClsiManager.sendExternalRequest(
          this.submission_id,
          this.clsi_request,
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
  })

  describe('deleteAuxFiles', function () {
    beforeEach(function () {
      this.ClsiManager._makeRequestWithClsiServerId = sinon.stub().yields(null)
      this.DocumentUpdaterHandler.clearProjectState = sinon.stub().callsArg(1)
    })

    describe('with the standard compileGroup', function () {
      beforeEach(function () {
        this.ClsiManager.deleteAuxFiles(
          this.project_id,
          this.user_id,
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          'node-1',
          this.callback
        )
      })

      it('should call the delete method in the standard CLSI', function () {
        this.ClsiManager._makeRequestWithClsiServerId
          .calledWith(
            this.project_id,
            this.user_id,
            'standard',
            'e2',
            {
              method: 'DELETE',
              url: `${this.settings.apis.clsi.url}/project/${this.project_id}/user/${this.user_id}?compileBackendClass=e2&compileGroup=standard`,
            },
            'node-1'
          )
          .should.equal(true)
      })

      it('should clear the project state from the docupdater', function () {
        this.DocumentUpdaterHandler.clearProjectState
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should clear the clsi persistance', function () {
        this.ClsiCookieManager.clearServerId
          .calledWith(this.project_id, this.user_id)
          .should.equal(true)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })
  })

  describe('_buildRequest', function () {
    beforeEach(function () {
      this.project = {
        _id: this.project_id,
        compiler: (this.compiler = 'latex'),
        rootDoc_id: 'mock-doc-id-1',
        imageName: (this.image = 'mock-image-name'),
      }

      this.docs = {
        '/main.tex': (this.doc_1 = {
          name: 'main.tex',
          _id: 'mock-doc-id-1',
          lines: ['Hello', 'world'],
        }),
        '/chapters/chapter1.tex': (this.doc_2 = {
          name: 'chapter1.tex',
          _id: 'mock-doc-id-2',
          lines: ['Chapter 1'],
        }),
      }

      this.files = {
        '/images/image.png': (this.file_1 = {
          name: 'image.png',
          _id: 'mock-file-id-1',
          created: new Date(),
        }),
      }

      this.Project.findById = sinon.stub().callsArgWith(2, null, this.project)
      this.ProjectEntityHandler.getAllDocs = sinon
        .stub()
        .callsArgWith(1, null, this.docs)
      this.ProjectEntityHandler.getAllFiles = sinon
        .stub()
        .callsArgWith(1, null, this.files)
      this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, this.project)
      this.DocumentUpdaterHandler.flushProjectToMongo = sinon
        .stub()
        .callsArgWith(1, null)
    })

    describe('with a valid project', function () {
      beforeEach(function (done) {
        this.ClsiManager._buildRequest(
          this.project_id,
          { timeout: 100, compileBackendClass: 'e2', compileGroup: 'standard' },
          (err, request) => {
            if (err != null) {
              return done(err)
            }
            this.request = request
            done()
          }
        )
      })

      it('should get the project with the required fields', function () {
        this.ProjectGetter.getProject
          .calledWith(this.project_id, {
            compiler: 1,
            rootDoc_id: 1,
            imageName: 1,
            rootFolder: 1,
          })
          .should.equal(true)
      })

      it('should flush the project to the database', function () {
        this.DocumentUpdaterHandler.flushProjectToMongo
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should get all the docs', function () {
        this.ProjectEntityHandler.getAllDocs
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should get all the files', function () {
        this.ProjectEntityHandler.getAllFiles
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should build up the CLSI request', function () {
        expect(this.request).to.deep.equal({
          compile: {
            options: {
              compiler: this.compiler,
              timeout: 100,
              imageName: this.image,
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
            }, // "01234567890abcdef"
            rootResourcePath: 'main.tex',
            resources: [
              {
                path: 'main.tex',
                content: this.doc_1.lines.join('\n'),
              },
              {
                path: 'chapters/chapter1.tex',
                content: this.doc_2.lines.join('\n'),
              },
              {
                path: 'images/image.png',
                url: `${this.settings.apis.filestore.url}/project/${this.project_id}/file/${this.file_1._id}`,
                modified: this.file_1.created.getTime(),
              },
            ],
          },
        })
      })
    })

    describe('with the incremental compile option', function () {
      beforeEach(function (done) {
        this.project_state_hash = '01234567890abcdef'
        this.ClsiStateManager.computeHash = sinon
          .stub()
          .returns(this.project_state_hash)
        this.DocumentUpdaterHandler.getProjectDocsIfMatch = sinon
          .stub()
          .callsArgWith(2, null, [
            { _id: this.doc_1._id, lines: this.doc_1.lines, v: 123 },
          ])
        this.ProjectEntityHandler.getAllDocPathsFromProject = sinon
          .stub()
          .returns({ 'mock-doc-id-1': 'main.tex' })
        this.ClsiManager._buildRequest(
          this.project_id,
          {
            timeout: 100,
            incrementalCompilesEnabled: true,
            compileGroup: 'priority',
            enablePdfCaching: true,
            pdfCachingMinChunkSize: 1337,
          },
          (err, request) => {
            if (err != null) {
              return done(err)
            }
            this.request = request
            done()
          }
        )
      })

      it('should get the project with the required fields', function () {
        this.ProjectGetter.getProject
          .calledWith(this.project_id, {
            compiler: 1,
            rootDoc_id: 1,
            imageName: 1,
            rootFolder: 1,
          })
          .should.equal(true)
      })

      it('should not explicitly flush the project to the database', function () {
        this.DocumentUpdaterHandler.flushProjectToMongo
          .calledWith(this.project_id)
          .should.equal(false)
      })

      it('should get only the live docs from the docupdater with a background flush in docupdater', function () {
        this.DocumentUpdaterHandler.getProjectDocsIfMatch
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should not get any of the files', function () {
        this.ProjectEntityHandler.getAllFiles.called.should.equal(false)
      })

      it('should build up the CLSI request', function () {
        expect(this.request).to.deep.equal({
          compile: {
            options: {
              compiler: this.compiler,
              timeout: 100,
              imageName: this.image,
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
                content: this.doc_1.lines.join('\n'),
              },
            ],
          },
        })
      })

      describe('when the root doc is set and not in the docupdater', function () {
        beforeEach(function (done) {
          this.project_state_hash = '01234567890abcdef'
          this.ClsiStateManager.computeHash = sinon
            .stub()
            .returns(this.project_state_hash)
          this.DocumentUpdaterHandler.getProjectDocsIfMatch = sinon
            .stub()
            .callsArgWith(2, null, [
              { _id: this.doc_1._id, lines: this.doc_1.lines, v: 123 },
            ])
          this.ProjectEntityHandler.getAllDocPathsFromProject = sinon
            .stub()
            .returns({
              'mock-doc-id-1': 'main.tex',
              'mock-doc-id-2': '/chapters/chapter1.tex',
            })
          this.ClsiManager._buildRequest(
            this.project_id,
            {
              timeout: 100,
              incrementalCompilesEnabled: true,
              rootDoc_id: 'mock-doc-id-2',
            },
            (err, request) => {
              if (err != null) {
                return done(err)
              }
              this.request = request
              done()
            }
          )
        })

        it('should still change the root path', function () {
          this.request.compile.rootResourcePath.should.equal(
            'chapters/chapter1.tex'
          )
        })
      })
    })

    describe('when root doc override is valid', function () {
      beforeEach(function (done) {
        this.ClsiManager._buildRequest(
          this.project_id,
          { rootDoc_id: 'mock-doc-id-2' },
          (err, request) => {
            if (err != null) {
              return done(err)
            }
            this.request = request
            done()
          }
        )
      })

      it('should change root path', function () {
        this.request.compile.rootResourcePath.should.equal(
          'chapters/chapter1.tex'
        )
      })
    })

    describe('when root doc override is invalid', function () {
      beforeEach(function (done) {
        this.ClsiManager._buildRequest(
          this.project_id,
          { rootDoc_id: 'invalid-id' },
          (err, request) => {
            if (err != null) {
              return done(err)
            }
            this.request = request
            done()
          }
        )
      })

      it('should fallback to default root doc', function () {
        this.request.compile.rootResourcePath.should.equal('main.tex')
      })
    })

    describe('when the project has an invalid compiler', function () {
      beforeEach(function (done) {
        this.project.compiler = 'context'
        this.ClsiManager._buildRequest(this.project, null, (err, request) => {
          if (err != null) {
            return done(err)
          }
          this.request = request
          done()
        })
      })

      it('should set the compiler to pdflatex', function () {
        this.request.compile.options.compiler.should.equal('pdflatex')
      })
    })

    describe('when there is no valid root document', function () {
      beforeEach(function (done) {
        this.project.rootDoc_id = 'not-valid'
        this.ClsiManager._buildRequest(this.project, null, (error, request) => {
          this.error = error
          this.request = request
          done()
        })
      })

      it('should set to main.tex', function () {
        this.request.compile.rootResourcePath.should.equal('main.tex')
      })
    })

    describe('when there is no valid root document and no main.tex document', function () {
      beforeEach(function () {
        this.project.rootDoc_id = 'not-valid'
        this.docs = {
          '/other.tex': (this.doc_1 = {
            name: 'other.tex',
            _id: 'mock-doc-id-1',
            lines: ['Hello', 'world'],
          }),
          '/chapters/chapter1.tex': (this.doc_2 = {
            name: 'chapter1.tex',
            _id: 'mock-doc-id-2',
            lines: ['Chapter 1'],
          }),
        }
        this.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        this.ClsiManager._buildRequest(this.project, null, this.callback)
      })

      it('should report an error', function () {
        this.callback.should.have.been.calledWith(sinon.match.instanceOf(Error))
      })
    })

    describe('when there is no valid root document and a single document which is not main.tex', function () {
      beforeEach(function (done) {
        this.project.rootDoc_id = 'not-valid'
        this.docs = {
          '/other.tex': (this.doc_1 = {
            name: 'other.tex',
            _id: 'mock-doc-id-1',
            lines: ['Hello', 'world'],
          }),
        }
        this.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        this.ClsiManager._buildRequest(this.project, null, (error, request) => {
          this.error = error
          this.request = request
          done()
        })
      })

      it('should set io to the only file', function () {
        this.request.compile.rootResourcePath.should.equal('other.tex')
      })
    })

    describe('with the draft option', function () {
      it('should add the draft option into the request', function (done) {
        this.ClsiManager._buildRequest(
          this.project_id,
          { timeout: 100, draft: true },
          (err, request) => {
            if (err != null) {
              return done(err)
            }
            request.compile.options.draft.should.equal(true)
            done()
          }
        )
      })
    })
  })

  describe('_postToClsi', function () {
    beforeEach(function () {
      this.req = { mock: 'req', compile: {} }
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.ClsiManager._makeRequest = sinon
          .stub()
          .yields(null, { statusCode: 204 }, (this.body = { mock: 'foo' }))
        this.ClsiManager._postToClsi(
          this.project_id,
          this.user_id,
          this.req,
          'e2',
          'standard',
          this.callback
        )
      })

      it('should send the request to the CLSI', function () {
        const url = `${this.settings.apis.clsi.url}/project/${this.project_id}/user/${this.user_id}/compile?compileBackendClass=e2&compileGroup=standard`
        this.ClsiManager._makeRequest
          .calledWith(this.project_id, this.user_id, 'standard', 'e2', {
            method: 'POST',
            url,
            json: this.req,
          })
          .should.equal(true)
      })

      it('should call the callback with the body and no error', function () {
        this.callback.calledWith(null, this.body).should.equal(true)
      })
    })

    describe('when the CLSI returns an error', function () {
      beforeEach(function () {
        this.ClsiManager._makeRequest = sinon
          .stub()
          .yields(null, { statusCode: 500 }, (this.body = { mock: 'foo' }))
        this.ClsiManager._postToClsi(
          this.project_id,
          this.user_id,
          this.req,
          'e2',
          'standard',
          this.callback
        )
      })

      it('should call the callback with an error', function () {
        this.callback.should.have.been.calledWith(sinon.match.instanceOf(Error))
      })
    })
  })

  describe('wordCount', function () {
    beforeEach(function () {
      this.ClsiManager._makeRequestWithClsiServerId = sinon
        .stub()
        .yields(null, { statusCode: 200 }, (this.body = { mock: 'foo' }))
      this.ClsiManager._buildRequest = sinon.stub().yields(
        null,
        (this.req = {
          compile: { rootResourcePath: 'rootfile.text', options: {} },
        })
      )
    })

    describe('with root file', function () {
      beforeEach(function () {
        this.ClsiManager.wordCount(
          this.project_id,
          this.user_id,
          false,
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          'node-1',
          this.callback
        )
      })

      it('should call wordCount with root file', function () {
        this.ClsiManager._makeRequestWithClsiServerId
          .calledWith(
            this.project_id,
            this.user_id,
            'standard',
            'e2',
            {
              method: 'GET',
              url: `http://clsi.example.com/project/${this.project_id}/user/${this.user_id}/wordcount?compileBackendClass=e2&compileGroup=standard`,
              qs: {
                file: 'rootfile.text',
                image: undefined,
              },
              json: true,
            },
            'node-1'
          )
          .should.equal(true)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('with param file', function () {
      beforeEach(function () {
        this.ClsiManager.wordCount(
          this.project_id,
          this.user_id,
          'main.tex',
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          'node-2',
          this.callback
        )
      })

      it('should call wordCount with param file', function () {
        this.ClsiManager._makeRequestWithClsiServerId
          .calledWith(
            this.project_id,
            this.user_id,
            'standard',
            'e2',
            {
              method: 'GET',
              url: `http://clsi.example.com/project/${this.project_id}/user/${this.user_id}/wordcount?compileBackendClass=e2&compileGroup=standard`,
              qs: { file: 'main.tex', image: undefined },
              json: true,
            },
            'node-2'
          )
          .should.equal(true)
      })
    })

    describe('with image', function () {
      beforeEach(function () {
        this.req.compile.options.imageName = this.image =
          'example.com/mock/image'
        this.ClsiManager.wordCount(
          this.project_id,
          this.user_id,
          'main.tex',
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          'node-3',
          this.callback
        )
      })

      it('should call wordCount with file and image', function () {
        this.ClsiManager._makeRequestWithClsiServerId
          .calledWith(
            this.project_id,
            this.user_id,
            'standard',
            'e2',
            {
              method: 'GET',
              url: `http://clsi.example.com/project/${this.project_id}/user/${this.user_id}/wordcount?compileBackendClass=e2&compileGroup=standard`,
              qs: { file: 'main.tex', image: this.image },
              json: true,
            },
            'node-3'
          )
          .should.equal(true)
      })
    })
  })

  describe('_makeRequest', function () {
    beforeEach(function () {
      this.response = { there: 'something' }
      this.request.callsArgWith(1, null, this.response)
      this.opts = {
        method: 'SOMETHIGN',
        url: 'http://a place on the web',
      }
    })

    it('should process a request with a cookie jar', function (done) {
      this.ClsiManager._makeRequest(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.opts,
        () => {
          const args = this.request.args[0]
          args[0].method.should.equal(this.opts.method)
          args[0].url.should.equal(this.opts.url)
          args[0].jar.should.equal(this.jar)
          done()
        }
      )
    })

    it('should set the cookie again on response as it might have changed', function (done) {
      this.ClsiManager._makeRequest(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.opts,
        () => {
          this.ClsiCookieManager.setServerId
            .calledWith(
              this.project_id,
              this.user_id,
              'standard',
              'e2',
              this.response
            )
            .should.equal(true)
          done()
        }
      )
    })
  })

  describe('_makeRequestWithClsiServerId', function () {
    beforeEach(function () {
      this.response = { statusCode: 200 }
      this.request.yields(null, this.response)
      this.opts = {
        method: 'GET',
        url: 'http://clsi',
      }
    })

    describe('with a regular request', function () {
      it('should process a request with a cookie jar', function (done) {
        this.ClsiManager._makeRequestWithClsiServerId(
          this.project_id,
          this.user_id,
          'standard',
          'e2',
          this.opts,
          undefined,
          err => {
            if (err) return done(err)
            const args = this.request.args[0]
            args[0].method.should.equal(this.opts.method)
            args[0].url.should.equal(this.opts.url)
            args[0].jar.should.equal(this.jar)
            expect(args[0].qs).to.not.exist
            done()
          }
        )
      })

      it('should persist the cookie from the response', function (done) {
        this.ClsiManager._makeRequestWithClsiServerId(
          this.project_id,
          this.user_id,
          'standard',
          'e2',
          this.opts,
          undefined,
          err => {
            if (err) return done(err)
            this.ClsiCookieManager.setServerId
              .calledWith(
                this.project_id,
                this.user_id,
                'standard',
                'e2',
                this.response
              )
              .should.equal(true)
            done()
          }
        )
      })
    })

    describe('with a persistent request', function () {
      it('should not add a cookie jar', function (done) {
        this.ClsiManager._makeRequestWithClsiServerId(
          this.project_id,
          this.user_id,
          'standard',
          'e2',
          this.opts,
          'node-1',
          err => {
            if (err) return done(err)
            const requestOpts = this.request.args[0][0]
            expect(requestOpts.method).to.equal(this.opts.method)
            expect(requestOpts.url).to.equal(this.opts.url)
            expect(requestOpts.jar).to.not.exist
            expect(requestOpts.qs).to.deep.equal({
              clsiserverid: 'node-1',
              compileGroup: 'standard',
              compileBackendClass: 'e2',
            })
            done()
          }
        )
      })

      it('should not persist a cookie on response', function (done) {
        this.ClsiManager._makeRequestWithClsiServerId(
          this.project_id,
          this.user_id,
          'standard',
          'e2',
          this.opts,
          'node-1',
          err => {
            if (err) return done(err)
            expect(this.ClsiCookieManager.setServerId.called).to.equal(false)
            done()
          }
        )
      })
    })
  })

  describe('_makeGoogleCloudRequest', function () {
    beforeEach(function () {
      this.settings.apis.clsi_new = { url: 'https://compiles.somewhere.test' }
      this.response = { there: 'something' }
      this.request.callsArgWith(1, null, this.response)
      this.opts = {
        url: this.ClsiManager._getCompilerUrl(
          'e2',
          'standard',
          this.project_id
        ),
      }
    })

    it('should change the domain on the url', function (done) {
      this.ClsiManager._makeNewBackendRequest(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.opts,
        () => {
          const args = this.request.args[0]
          args[0].url.should.equal(
            `https://compiles.somewhere.test/project/${this.project_id}?compileBackendClass=e2&compileGroup=standard`
          )
          done()
        }
      )
    })

    it('should not make a request if there is not clsi_new url', function (done) {
      this.settings.apis.clsi_new = undefined
      this.ClsiManager._makeNewBackendRequest(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.opts,
        err => {
          expect(err).to.equal(undefined)
          this.request.callCount.should.equal(0)
          done()
        }
      )
    })
  })
})
