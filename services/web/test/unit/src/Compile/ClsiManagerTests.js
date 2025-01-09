const { setTimeout } = require('timers/promises')
const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const tk = require('timekeeper')
const { RequestFailedError } = require('@overleaf/fetch-utils')

const FILESTORE_URL = 'http://filestore.example.com'
const CLSI_HOST = 'clsi.example.com'
const MODULE_PATH = '../../../../app/src/Features/Compile/ClsiManager.js'

const GLOBAL_BLOB_HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

describe('ClsiManager', function () {
  beforeEach(function () {
    this.user_id = 'user-id'
    this.project = {
      _id: 'project-id',
      compiler: 'latex',
      rootDoc_id: 'mock-doc-id-1',
      imageName: 'mock-image-name',
      overleaf: { history: { id: 42 } },
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
      '/images/frog.png': {
        name: 'frog.png',
        _id: 'mock-file-id-1',
        created: new Date(),
        hash: GLOBAL_BLOB_HASH,
      },
      '/images/image.png': {
        name: 'image.png',
        _id: 'mock-file-id-2',
        created: new Date(),
        hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
      '/images/no-hash.png': {
        name: 'no-hash.png',
        _id: 'mock-file-id-3',
        created: new Date(),
      },
    }
    this.clsiCookieKey = 'clsiserver'
    this.clsiServerId = 'clsi-server-id'
    this.newClsiServerId = 'newserver'
    this.rawOutputFiles = {}
    this.responseBody = {
      compile: { status: 'success' },
    }
    this.response = {
      ok: true,
      status: 200,
      headers: {
        raw: sinon.stub().returns({
          'set-cookie': [`${this.clsiCookieKey}=${this.newClsiServerId}`],
        }),
      },
    }

    this.FetchUtils = {
      fetchString: sinon
        .stub()
        .callsFake(() => Promise.resolve(JSON.stringify(this.responseBody))),
      fetchStringWithResponse: sinon.stub().callsFake(() =>
        Promise.resolve({
          body: JSON.stringify(this.responseBody),
          response: this.response,
        })
      ),
      fetchStream: sinon.stub(),
      RequestFailedError,
    }
    this.ClsiCookieManager = {
      promises: {
        clearServerId: sinon.stub().resolves(),
        getServerId: sinon.stub().resolves('clsi-server-id'),
        setServerId: sinon.stub().resolves(),
      },
    }
    this.ClsiStateManager = {
      computeHash: sinon.stub().returns('01234567890abcdef'),
    }
    this.ClsiFormatChecker = {
      promises: {
        checkRecoursesForProblems: sinon.stub().resolves(),
      },
    }
    this.Project = {}
    this.ProjectEntityHandler = {
      getAllDocPathsFromProject: sinon.stub(),
      promises: {
        getAllDocs: sinon.stub().resolves(this.docs),
        getAllFiles: sinon.stub().resolves(this.files),
      },
    }
    this.ProjectGetter = {
      promises: {
        findById: sinon.stub().resolves(this.project),
        getProject: sinon.stub().resolves(this.project),
      },
    }
    this.DocumentUpdaterHandler = {
      promises: {
        clearProjectState: sinon.stub().resolves(),
        flushProjectToMongo: sinon.stub().resolves(),
        getProjectDocsIfMatch: sinon.stub().resolves(),
      },
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
    this.Settings = {
      apis: {
        filestore: {
          url: FILESTORE_URL,
          secret: 'secret',
        },
        clsi: {
          url: `http://${CLSI_HOST}`,
          submissionBackendClass: 'n2d',
        },
        clsi_priority: {
          url: 'https://clsipremium.example.com',
        },
      },
      enablePdfCaching: true,
      clsiCookie: { key: 'clsiserver' },
    }
    this.Features = {
      hasFeature: sinon.stub().withArgs('project-history-blobs').returns(true),
    }
    this.HistoryManager = {
      getBlobLocation: sinon.stub().callsFake((historyId, hash) => {
        if (hash === GLOBAL_BLOB_HASH) {
          return {
            bucket: 'global-blobs',
            key: 'aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          }
        }
        return { bucket: 'project-blobs', key: `${historyId}/${hash}` }
      }),
    }

    this.ClsiManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': this.Settings,
        '../../models/Project': {
          Project: this.Project,
        },
        '../../infrastructure/Features': this.Features,
        '../Project/ProjectEntityHandler': this.ProjectEntityHandler,
        '../Project/ProjectGetter': this.ProjectGetter,
        '../DocumentUpdater/DocumentUpdaterHandler':
          this.DocumentUpdaterHandler,
        './ClsiCookieManager': () => this.ClsiCookieManager,
        './ClsiStateManager': this.ClsiStateManager,
        '@overleaf/fetch-utils': this.FetchUtils,
        './ClsiFormatChecker': this.ClsiFormatChecker,
        '@overleaf/metrics': this.Metrics,
        '../History/HistoryManager': this.HistoryManager,
      },
    })
    tk.freeze(Date.now())
  })

  after(function () {
    tk.reset()
  })

  describe('sendRequest', function () {
    describe('with a successful compile', function () {
      const buildId = '18fbe9e7564-30dcb2f71250c690'

      beforeEach(async function () {
        this.outputFiles = [
          {
            url: `/project/${this.project_id}/user/${this.user_id}/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: buildId,
          },
          {
            url: `/project/${this.project_id}/user/${this.user_id}/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: buildId,
          },
        ]
        this.responseBody.compile.outputFiles = this.outputFiles.map(
          outputFile => ({
            ...outputFile,
            url: `http://${CLSI_HOST}${outputFile.url}`,
          })
        )
        this.responseBody.compile.buildId = buildId
        this.timeout = 100
        this.result = await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          {
            compileBackendClass: 'e2',
            compileGroup: 'standard',
            timeout: this.timeout,
          }
        )
      })

      it('should send the request to the CLSI', function () {
        this.FetchUtils.fetchStringWithResponse.should.have.been.calledWith(
          sinon.match(
            url =>
              url.host === CLSI_HOST &&
              url.pathname ===
                `/project/${this.project._id}/user/${this.user_id}/compile` &&
              url.searchParams.get('compileBackendClass') === 'e2' &&
              url.searchParams.get('compileGroup') === 'standard'
          ),
          {
            method: 'POST',
            json: sinon.match({
              compile: {
                options: {
                  compiler: this.project.compiler,
                  imageName: this.project.imageName,
                  timeout: this.timeout,
                  draft: false,
                  compileGroup: 'standard',
                  metricsMethod: 'standard',
                  stopOnFirstError: false,
                  syncType: undefined,
                },
                rootResourcePath: 'main.tex',
                resources: _makeResources(this.project, this.docs, this.files),
              },
            }),
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Cookie: `${this.clsiCookieKey}=${this.clsiServerId}`,
            },
            signal: sinon.match.instanceOf(AbortSignal),
          }
        )
      })

      it('should get the project with the required fields', function () {
        this.ProjectGetter.promises.getProject.should.have.been.calledWith(
          this.project._id,
          {
            compiler: 1,
            rootDoc_id: 1,
            imageName: 1,
            rootFolder: 1,
            'overleaf.history.id': 1,
          }
        )
      })

      it('should flush the project to the database', function () {
        this.DocumentUpdaterHandler.promises.flushProjectToMongo.should.have.been.calledWith(
          this.project._id
        )
      })

      it('should get all the docs', function () {
        this.ProjectEntityHandler.promises.getAllDocs.should.have.been.calledWith(
          this.project._id
        )
      })

      it('should get all the files', function () {
        this.ProjectEntityHandler.promises.getAllFiles.should.have.been.calledWith(
          this.project._id
        )
      })

      it('should return the status and output files', function () {
        expect(this.result.status).to.equal('success')
        expect(this.result.outputFiles.map(f => f.path)).to.have.members(
          this.outputFiles.map(f => f.path)
        )
      })

      it('should return the buildId', function () {
        expect(this.result.buildId).to.equal(buildId)
      })

      it('should persist the cookie from the response', function () {
        expect(
          this.ClsiCookieManager.promises.setServerId
        ).to.have.been.calledWith(
          this.project._id,
          this.user_id,
          'standard',
          'e2',
          this.newClsiServerId
        )
      })
    })

    describe('with ranges on the pdf and stats/timings details', function () {
      beforeEach(async function () {
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
        this.responseBody.compile.outputFiles = this.outputFiles.map(
          outputFile => ({
            ...outputFile,
            url: `http://${CLSI_HOST}${outputFile.url}`,
          })
        )
        this.responseBody.compile.stats = this.stats
        this.responseBody.compile.timings = this.timings
        this.result = await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          { compileBackendClass: 'e2', compileGroup: 'standard' }
        )
      })

      it('should emit the caching details and stats/timings', function () {
        expect(this.result.status).to.equal('success')
        expect(this.result.clsiServerId).to.equal(this.newClsiServerId)
        expect(this.result.validationError).to.be.undefined
        expect(this.result.stats).to.deep.equal(this.stats)
        expect(this.result.timings).to.deep.equal(this.timings)
        const outputPdf = this.result.outputFiles.find(
          f => f.path === 'output.pdf'
        )
        expect(outputPdf.ranges).to.deep.equal(this.ranges)
        expect(outputPdf.startXRefTable).to.equal(this.startXRefTable)
        expect(outputPdf.contentId).to.equal(this.contentId)
        expect(outputPdf.size).to.equal(this.size)
      })
    })

    describe('with the incremental compile option', function () {
      beforeEach(async function () {
        const doc = this.docs['/main.tex']
        this.DocumentUpdaterHandler.promises.getProjectDocsIfMatch.resolves([
          { _id: doc._id, lines: doc.lines, v: 123 },
        ])
        this.ProjectEntityHandler.getAllDocPathsFromProject.returns({
          'mock-doc-id-1': 'main.tex',
        })
        this.result = await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          {
            timeout: 100,
            incrementalCompilesEnabled: true,
            compileBackendClass: 'e2',
            compileGroup: 'priority',
            enablePdfCaching: true,
            pdfCachingMinChunkSize: 1337,
          }
        )
      })

      it('should get the project with the required fields', function () {
        this.ProjectGetter.promises.getProject.should.have.been.calledWith(
          this.project._id,
          {
            compiler: 1,
            rootDoc_id: 1,
            imageName: 1,
            rootFolder: 1,
            'overleaf.history.id': 1,
          }
        )
      })

      it('should not explicitly flush the project to the database', function () {
        this.DocumentUpdaterHandler.promises.flushProjectToMongo.should.not.have.been.calledWith(
          this.project._id
        )
      })

      it('should get only the live docs from the docupdater with a background flush in docupdater', function () {
        this.DocumentUpdaterHandler.promises.getProjectDocsIfMatch.should.have.been.calledWith(
          this.project._id
        )
      })

      it('should not get any of the files', function () {
        this.ProjectEntityHandler.promises.getAllFiles.should.not.have.been
          .called
      })

      it('should build up the CLSI request', function () {
        this.FetchUtils.fetchStringWithResponse.should.have.been.calledWith(
          sinon.match(
            url =>
              url.hostname === CLSI_HOST &&
              url.pathname ===
                `/project/${this.project._id}/user/${this.user_id}/compile` &&
              url.searchParams.get('compileBackendClass') === 'e2' &&
              url.searchParams.get('compileGroup') === 'priority'
          ),
          {
            method: 'POST',
            json: sinon.match({
              compile: {
                options: {
                  compiler: this.project.compiler,
                  timeout: 100,
                  imageName: this.project.imageName,
                  draft: false,
                  syncType: 'incremental',
                  syncState: '01234567890abcdef',
                  compileGroup: 'priority',
                  enablePdfCaching: true,
                  pdfCachingMinChunkSize: 1337,
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
            }),
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Cookie: `${this.clsiCookieKey}=${this.clsiServerId}`,
            },
            signal: sinon.match.instanceOf(AbortSignal),
          }
        )
      })
    })

    describe('when the root doc is set and not in the docupdater', function () {
      beforeEach(async function () {
        const doc = this.docs['/main.tex']
        this.DocumentUpdaterHandler.promises.getProjectDocsIfMatch.resolves([
          { _id: doc._id, lines: doc.lines, v: 123 },
        ])
        this.ProjectEntityHandler.getAllDocPathsFromProject.returns({
          'mock-doc-id-1': 'main.tex',
          'mock-doc-id-2': '/chapters/chapter1.tex',
        })
        await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          {
            timeout: 100,
            incrementalCompilesEnabled: true,
            rootDoc_id: 'mock-doc-id-2',
          }
        )
      })

      it('should still change the root path', function () {
        this.FetchUtils.fetchStringWithResponse.should.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { rootResourcePath: 'chapters/chapter1.tex' } },
          })
        )
      })
    })

    describe('when root doc override is valid', function () {
      beforeEach(async function () {
        await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          { rootDoc_id: 'mock-doc-id-2' }
        )
      })

      it('should change root path', function () {
        this.FetchUtils.fetchStringWithResponse.should.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { rootResourcePath: 'chapters/chapter1.tex' } },
          })
        )
      })
    })

    describe('when root doc override is invalid', function () {
      beforeEach(async function () {
        await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          { rootDoc_id: 'invalid-id' }
        )
      })

      it('should fallback to default root doc', function () {
        this.FetchUtils.fetchStringWithResponse.should.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { rootResourcePath: 'main.tex' } },
          })
        )
      })
    })

    describe('when the project has an invalid compiler', function () {
      beforeEach(async function () {
        this.project.compiler = 'context'
        await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          {}
        )
      })

      it('should set the compiler to pdflatex', function () {
        expect(this.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { options: { compiler: 'pdflatex' } } },
          })
        )
      })
    })

    describe('when there is no valid root document', function () {
      beforeEach(async function () {
        this.project.rootDoc_id = 'not-valid'
        await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          {}
        )
      })

      it('should set to main.tex', function () {
        expect(this.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { rootResourcePath: 'main.tex' } },
          })
        )
      })
    })

    describe('when there is no valid root document and no main.tex document', function () {
      beforeEach(async function () {
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
        this.ProjectEntityHandler.promises.getAllDocs.resolves(this.docs)
        this.result = await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          {}
        )
      })

      it('should report a validation problem', function () {
        expect(this.result.status).to.equal('validation-problems')
      })
    })

    describe('when there is no valid root document and a single document which is not main.tex', function () {
      beforeEach(async function () {
        this.project.rootDoc_id = 'not-valid'
        this.docs = {
          '/other.tex': {
            name: 'other.tex',
            _id: 'mock-doc-id-1',
            lines: ['Hello', 'world'],
          },
        }
        this.ProjectEntityHandler.promises.getAllDocs.resolves(this.docs)
        await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          {}
        )
      })

      it('should set io to the only file', function () {
        expect(this.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { rootResourcePath: 'other.tex' } },
          })
        )
      })
    })

    describe('with the draft option', function () {
      beforeEach(async function () {
        await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          {
            timeout: 100,
            draft: true,
          }
        )
      })

      it('should add the draft option into the request', function () {
        expect(this.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { options: { draft: true } } },
          })
        )
      })
    })

    describe('with a failed compile', function () {
      beforeEach(async function () {
        this.responseBody.compile.status = 'failure'
        this.result = await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          {}
        )
      })

      it('should return a failure status', function () {
        expect(this.result.status).to.equal('failure')
      })
    })

    describe('with a sync conflict', function () {
      beforeEach(async function () {
        const conflictResponseBody = { compile: { status: 'conflict' } }
        this.FetchUtils.fetchStringWithResponse
          .withArgs(
            sinon.match.any,
            sinon.match({
              json: sinon.match(
                json => json.compile.options.syncType !== 'full'
              ),
            })
          )
          .resolves({
            body: JSON.stringify(conflictResponseBody),
            response: this.response,
          })
        this.result = await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          {}
        )
      })

      it('should send two requests to CLSI', function () {
        this.FetchUtils.fetchStringWithResponse.should.have.been.calledTwice
      })

      it('should call the CLSI first without syncType:full', function () {
        const compileOptions =
          this.FetchUtils.fetchStringWithResponse.getCall(0).args[1].json
            .compile.options
        expect(compileOptions.syncType).to.be.undefined
      })

      it('should call the CLSI a second time with syncType:full', function () {
        const compileOptions =
          this.FetchUtils.fetchStringWithResponse.getCall(1).args[1].json
            .compile.options
        expect(compileOptions.syncType).to.equal('full')
      })

      it('should return a success status', function () {
        this.result.status.should.equal('success')
      })
    })

    describe('with an unavailable response', function () {
      beforeEach(async function () {
        this.FetchUtils.fetchStringWithResponse.onCall(0).resolves({
          body: JSON.stringify({ compile: { status: 'unavailable' } }),
          response: this.response,
        })
        this.result = await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          {}
        )
      })

      it('should send two requests to CLSI', function () {
        this.FetchUtils.fetchStringWithResponse.should.have.been.calledTwice
      })

      it('should call the CLSI first without syncType:full', function () {
        const compileOptions =
          this.FetchUtils.fetchStringWithResponse.getCall(0).args[1].json
            .compile.options
        expect(compileOptions.syncType).to.be.undefined
      })

      it('should call the CLSI a second time with syncType:full', function () {
        const compileOptions =
          this.FetchUtils.fetchStringWithResponse.getCall(1).args[1].json
            .compile.options
        expect(compileOptions.syncType).to.equal('full')
      })

      it('should clear the CLSI server id cookie', function () {
        expect(
          this.ClsiCookieManager.promises.clearServerId
        ).to.have.been.calledWith(this.project._id, this.user_id)
      })

      it('should return a success status', function () {
        expect(this.result.status).to.equal('success')
      })
    })

    describe('when the resources fail the precompile check', function () {
      beforeEach(function () {
        this.ClsiFormatChecker.promises.checkRecoursesForProblems.rejects(
          new Error('failed')
        )
      })

      it('should throw an error', async function () {
        await expect(
          this.ClsiManager.promises.sendRequest(
            this.project._id,
            this.user_id,
            {}
          )
        ).to.be.rejected
      })
    })

    describe('when a new backend is configured', function () {
      beforeEach(async function () {
        this.Settings.apis.clsi_new = { url: 'https://compiles.somewhere.test' }
        await this.ClsiManager.promises.sendRequest(
          this.project._id,
          this.user_id,
          {
            compileBackendClass: 'e2',
            compileGroup: 'standard',
          }
        )
        // wait for the background task to finish
        await setTimeout(0)
      })

      it('makes a request to the new backend', function () {
        expect(this.FetchUtils.fetchStringWithResponse).to.have.been.calledTwice
        expect(this.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match(
            url =>
              url.host === CLSI_HOST &&
              url.pathname ===
                `/project/${this.project._id}/user/${this.user_id}/compile` &&
              url.searchParams.get('compileBackendClass') === 'e2' &&
              url.searchParams.get('compileGroup') === 'standard'
          )
        )
        expect(this.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match(
            url =>
              url.toString() ===
              `${this.Settings.apis.clsi_new.url}/project/${this.project._id}/user/${this.user_id}/compile?compileBackendClass=e2&compileGroup=standard`
          )
        )
      })
    })
  })

  describe('sendExternalRequest', function () {
    beforeEach(function () {
      this.submissionId = 'submission-id'
      this.clsiRequest = 'mock-request'
    })

    describe('with a successful compile', function () {
      beforeEach(async function () {
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
          outputFile => ({
            ...outputFile,
            url: `http://${CLSI_HOST}${outputFile.url}`,
          })
        )
        this.result = await this.ClsiManager.promises.sendExternalRequest(
          this.submissionId,
          this.clsiRequest,
          { compileBackendClass: 'e2', compileGroup: 'standard' }
        )
      })

      it('should send the request to the CLSI', function () {
        this.FetchUtils.fetchStringWithResponse.should.have.been.calledWith(
          sinon.match(
            url =>
              url.host === CLSI_HOST &&
              url.pathname === `/project/${this.submissionId}/compile` &&
              url.searchParams.get('compileBackendClass') === 'e2' &&
              url.searchParams.get('compileGroup') === 'standard'
          ),
          {
            method: 'POST',
            json: this.clsiRequest,
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Cookie: `${this.clsiCookieKey}=${this.clsiServerId}`,
            },
            signal: sinon.match.instanceOf(AbortSignal),
          }
        )
      })

      it('should return the status and output files', function () {
        expect(this.result.status).to.equal('success')
        expect(this.result.outputFiles.map(f => f.path)).to.have.members(
          this.outputFiles.map(f => f.path)
        )
      })
    })

    describe('with a failed compile', function () {
      beforeEach(async function () {
        this.responseBody.compile.status = 'failure'
        this.result = await this.ClsiManager.promises.sendExternalRequest(
          this.submissionId,
          this.clsiRequest,
          {}
        )
      })

      it('should return a failure status', function () {
        expect(this.result.status).to.equal('failure')
      })
    })

    describe('when the resources fail the precompile check', function () {
      beforeEach(async function () {
        this.ClsiFormatChecker.promises.checkRecoursesForProblems.rejects(
          new Error('failed')
        )
        this.responseBody.compile.status = 'failure'
      })

      it('should throw an error', async function () {
        await expect(
          this.ClsiManager.promises.sendExternalRequest(
            this.submissionId,
            this.clsiRequest,
            {}
          )
        ).to.be.rejected
      })
    })
  })

  describe('deleteAuxFiles', function () {
    describe('with the standard compileGroup', function () {
      beforeEach(async function () {
        await this.ClsiManager.promises.deleteAuxFiles(
          this.project._id,
          this.user_id,
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          'node-1'
        )
      })

      it('should call the delete method in the standard CLSI', function () {
        this.FetchUtils.fetchString.should.have.been.calledWith(
          sinon.match(
            url =>
              url.host === CLSI_HOST &&
              url.pathname ===
                `/project/${this.project._id}/user/${this.user_id}` &&
              url.searchParams.get('compileBackendClass') === 'e2' &&
              url.searchParams.get('compileGroup') === 'standard' &&
              url.searchParams.get('clsiserverid') === 'node-1'
          ),
          { method: 'DELETE' }
        )
      })

      it('should clear the project state from the docupdater', function () {
        this.DocumentUpdaterHandler.promises.clearProjectState
          .calledWith(this.project._id)
          .should.equal(true)
      })

      it('should clear the clsi persistance', function () {
        this.ClsiCookieManager.promises.clearServerId
          .calledWith(this.project._id, this.user_id)
          .should.equal(true)
      })

      it('should not persist a cookie on response', function () {
        expect(this.ClsiCookieManager.promises.setServerId).not.to.have.been
          .called
      })
    })
  })

  describe('wordCount', function () {
    describe('with root file', function () {
      beforeEach(async function () {
        await this.ClsiManager.promises.wordCount(
          this.project._id,
          this.user_id,
          false,
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          'node-1'
        )
      })

      it('should call wordCount with root file', function () {
        expect(this.FetchUtils.fetchString).to.have.been.calledWith(
          sinon.match(
            url =>
              url.toString() ===
              `http://clsi.example.com/project/${this.project._id}/user/${this.user_id}/wordcount?compileBackendClass=e2&compileGroup=standard&file=main.tex&image=mock-image-name&clsiserverid=node-1`
          )
        )
      })

      it('should not persist a cookie on response', function () {
        expect(this.ClsiCookieManager.promises.setServerId).not.to.have.been
          .called
      })
    })

    describe('with param file', function () {
      beforeEach(async function () {
        await this.ClsiManager.promises.wordCount(
          this.project._id,
          this.user_id,
          'other.tex',
          { compileBackendClass: 'e2', compileGroup: 'standard' },
          'node-2'
        )
      })

      it('should call wordCount with param file', function () {
        expect(this.FetchUtils.fetchString).to.have.been.calledWith(
          sinon.match(
            url =>
              url.host === CLSI_HOST &&
              url.pathname ===
                `/project/${this.project._id}/user/${this.user_id}/wordcount` &&
              url.searchParams.get('compileBackendClass') === 'e2' &&
              url.searchParams.get('compileGroup') === 'standard' &&
              url.searchParams.get('clsiserverid') === 'node-2' &&
              url.searchParams.get('file') === 'other.tex' &&
              url.searchParams.get('image') === 'mock-image-name'
          )
        )
      })

      it('should not persist a cookie on response', function () {
        expect(this.ClsiCookieManager.promises.setServerId).not.to.have.been
          .called
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
    let url, fallbackURL
    if (file.hash === GLOBAL_BLOB_HASH) {
      url = `${FILESTORE_URL}/bucket/global-blobs/key/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
      fallbackURL = `${FILESTORE_URL}/project/${project._id}/file/${file._id}`
    } else if (file.hash) {
      url = `${FILESTORE_URL}/bucket/project-blobs/key/${project.overleaf.history.id}/${file.hash}`
      fallbackURL = `${FILESTORE_URL}/project/${project._id}/file/${file._id}`
    } else {
      url = `${FILESTORE_URL}/project/${project._id}/file/${file._id}`
    }
    resources.push({
      path: path.replace(/^\//, ''),
      url,
      fallbackURL,
      modified: file.created.getTime(),
    })
  }
  return resources
}
