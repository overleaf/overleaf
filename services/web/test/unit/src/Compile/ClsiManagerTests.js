/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/Features/Compile/ClsiManager.js'
const SandboxedModule = require('sandboxed-module')

describe('ClsiManager', function() {
  beforeEach(function() {
    let Timer
    this.jar = { cookie: 'stuff' }
    this.ClsiCookieManager = {
      getCookieJar: sinon.stub().callsArgWith(1, null, this.jar),
      setServerId: sinon.stub().callsArgWith(2),
      _getServerId: sinon.stub()
    }
    this.ClsiStateManager = {
      computeHash: sinon.stub().callsArgWith(2, null, '01234567890abcdef')
    }
    this.ClsiFormatChecker = {
      checkRecoursesForProblems: sinon.stub().callsArgWith(1)
    }
    this.ClsiManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': (this.settings = {
          apis: {
            filestore: {
              url: 'filestore.example.com',
              secret: 'secret'
            },
            clsi: {
              url: 'http://clsi.example.com'
            },
            clsi_priority: {
              url: 'https://clsipremium.example.com'
            }
          }
        }),
        '../../models/Project': {
          Project: (this.Project = {})
        },
        '../Project/ProjectEntityHandler': (this.ProjectEntityHandler = {}),
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        '../DocumentUpdater/DocumentUpdaterHandler': (this.DocumentUpdaterHandler = {
          getProjectDocsIfMatch: sinon.stub().callsArgWith(2, null, null)
        }),
        './ClsiCookieManager': () => this.ClsiCookieManager,
        './ClsiStateManager': this.ClsiStateManager,
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub(),
          err: sinon.stub(),
          warn: sinon.stub()
        }),
        request: (this.request = sinon.stub()),
        './ClsiFormatChecker': this.ClsiFormatChecker,
        'metrics-sharelatex': (this.Metrics = {
          Timer: (Timer = (function() {
            Timer = class Timer {
              static initClass() {
                this.prototype.done = sinon.stub()
              }
            }
            Timer.initClass()
            return Timer
          })()),
          inc: sinon.stub()
        })
      }
    })
    this.project_id = 'project-id'
    this.user_id = 'user-id'
    return (this.callback = sinon.stub())
  })

  describe('sendRequest', function() {
    beforeEach(function() {
      this.ClsiManager._buildRequest = sinon
        .stub()
        .callsArgWith(2, null, (this.request = 'mock-request'))
      return this.ClsiCookieManager._getServerId.callsArgWith(1, null, 'clsi3')
    })

    describe('with a successful compile', function() {
      beforeEach(function() {
        this.ClsiManager._postToClsi = sinon.stub().callsArgWith(4, null, {
          compile: {
            status: (this.status = 'success'),
            outputFiles: [
              {
                url: `${this.settings.apis.clsi.url}/project/${
                  this.project_id
                }/user/${this.user_id}/build/1234/output/output.pdf`,
                path: 'output.pdf',
                type: 'pdf',
                build: 1234
              },
              {
                url: `${this.settings.apis.clsi.url}/project/${
                  this.project_id
                }/user/${this.user_id}/build/1234/output/output.log`,
                path: 'output.log',
                type: 'log',
                build: 1234
              }
            ]
          }
        })
        return this.ClsiManager.sendRequest(
          this.project_id,
          this.user_id,
          { compileGroup: 'standard' },
          this.callback
        )
      })

      it('should build the request', function() {
        return this.ClsiManager._buildRequest
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should send the request to the CLSI', function() {
        return this.ClsiManager._postToClsi
          .calledWith(this.project_id, this.user_id, this.request, 'standard')
          .should.equal(true)
      })

      it('should call the callback with the status and output files', function() {
        const outputFiles = [
          {
            url: `/project/${this.project_id}/user/${
              this.user_id
            }/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: 1234
          },
          {
            url: `/project/${this.project_id}/user/${
              this.user_id
            }/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: 1234
          }
        ]
        return this.callback
          .calledWith(null, this.status, outputFiles)
          .should.equal(true)
      })
    })

    describe('with a failed compile', function() {
      beforeEach(function() {
        this.ClsiManager._postToClsi = sinon.stub().callsArgWith(4, null, {
          compile: {
            status: (this.status = 'failure')
          }
        })
        return this.ClsiManager.sendRequest(
          this.project_id,
          this.user_id,
          {},
          this.callback
        )
      })

      it('should call the callback with a failure status', function() {
        return this.callback.calledWith(null, this.status).should.equal(true)
      })
    })

    describe('with a sync conflict', function() {
      beforeEach(function() {
        this.ClsiManager.sendRequestOnce = sinon.stub()
        this.ClsiManager.sendRequestOnce
          .withArgs(this.project_id, this.user_id, { syncType: 'full' })
          .callsArgWith(3, null, (this.status = 'success'))
        this.ClsiManager.sendRequestOnce
          .withArgs(this.project_id, this.user_id, {})
          .callsArgWith(3, null, 'conflict')
        return this.ClsiManager.sendRequest(
          this.project_id,
          this.user_id,
          {},
          this.callback
        )
      })

      it('should call the sendRequestOnce method twice', function() {
        return this.ClsiManager.sendRequestOnce.calledTwice.should.equal(true)
      })

      it('should call the sendRequestOnce method with syncType:full', function() {
        return this.ClsiManager.sendRequestOnce
          .calledWith(this.project_id, this.user_id, { syncType: 'full' })
          .should.equal(true)
      })

      it('should call the sendRequestOnce method without syncType:full', function() {
        return this.ClsiManager.sendRequestOnce
          .calledWith(this.project_id, this.user_id, {})
          .should.equal(true)
      })

      it('should call the callback with a success status', function() {
        return this.callback.calledWith(null, this.status).should.equal(true)
      })
    })

    describe('when the resources fail the precompile check', function() {
      beforeEach(function() {
        this.ClsiFormatChecker.checkRecoursesForProblems = sinon
          .stub()
          .callsArgWith(1, new Error('failed'))
        this.ClsiManager._postToClsi = sinon.stub().callsArgWith(4, null, {
          compile: {
            status: (this.status = 'failure')
          }
        })
        return this.ClsiManager.sendRequest(
          this.project_id,
          this.user_id,
          {},
          this.callback
        )
      })

      it('should call the callback only once', function() {
        return this.callback.calledOnce.should.equal(true)
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWithExactly(new Error('failed'))
          .should.equal(true)
      })
    })
  })

  describe('sendExternalRequest', function() {
    beforeEach(function() {
      this.submission_id = 'submission-id'
      this.clsi_request = 'mock-request'
      return this.ClsiCookieManager._getServerId.callsArgWith(1, null, 'clsi3')
    })

    describe('with a successful compile', function() {
      beforeEach(function() {
        this.ClsiManager._postToClsi = sinon.stub().callsArgWith(4, null, {
          compile: {
            status: (this.status = 'success'),
            outputFiles: [
              {
                url: `${this.settings.apis.clsi.url}/project/${
                  this.submission_id
                }/build/1234/output/output.pdf`,
                path: 'output.pdf',
                type: 'pdf',
                build: 1234
              },
              {
                url: `${this.settings.apis.clsi.url}/project/${
                  this.submission_id
                }/build/1234/output/output.log`,
                path: 'output.log',
                type: 'log',
                build: 1234
              }
            ]
          }
        })
        return this.ClsiManager.sendExternalRequest(
          this.submission_id,
          this.clsi_request,
          { compileGroup: 'standard' },
          this.callback
        )
      })

      it('should send the request to the CLSI', function() {
        return this.ClsiManager._postToClsi
          .calledWith(this.submission_id, null, this.clsi_request, 'standard')
          .should.equal(true)
      })

      it('should call the callback with the status and output files', function() {
        const outputFiles = [
          {
            url: `/project/${this.submission_id}/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: 1234
          },
          {
            url: `/project/${this.submission_id}/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: 1234
          }
        ]
        return this.callback
          .calledWith(null, this.status, outputFiles)
          .should.equal(true)
      })
    })

    describe('with a failed compile', function() {
      beforeEach(function() {
        this.ClsiManager._postToClsi = sinon.stub().callsArgWith(4, null, {
          compile: {
            status: (this.status = 'failure')
          }
        })
        return this.ClsiManager.sendExternalRequest(
          this.submission_id,
          this.clsi_request,
          {},
          this.callback
        )
      })

      it('should call the callback with a failure status', function() {
        return this.callback.calledWith(null, this.status).should.equal(true)
      })
    })

    describe('when the resources fail the precompile check', function() {
      beforeEach(function() {
        this.ClsiFormatChecker.checkRecoursesForProblems = sinon
          .stub()
          .callsArgWith(1, new Error('failed'))
        this.ClsiManager._postToClsi = sinon.stub().callsArgWith(4, null, {
          compile: {
            status: (this.status = 'failure')
          }
        })
        return this.ClsiManager.sendExternalRequest(
          this.submission_id,
          this.clsi_request,
          {},
          this.callback
        )
      })

      it('should call the callback only once', function() {
        return this.callback.calledOnce.should.equal(true)
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWithExactly(new Error('failed'))
          .should.equal(true)
      })
    })
  })

  describe('deleteAuxFiles', function() {
    beforeEach(function() {
      this.ClsiManager._makeRequest = sinon.stub().callsArg(2)
      return (this.DocumentUpdaterHandler.clearProjectState = sinon
        .stub()
        .callsArg(1))
    })

    describe('with the standard compileGroup', function() {
      beforeEach(function() {
        return this.ClsiManager.deleteAuxFiles(
          this.project_id,
          this.user_id,
          { compileGroup: 'standard' },
          this.callback
        )
      })

      it('should call the delete method in the standard CLSI', function() {
        return this.ClsiManager._makeRequest
          .calledWith(this.project_id, {
            method: 'DELETE',
            url: `${this.settings.apis.clsi.url}/project/${
              this.project_id
            }/user/${this.user_id}`
          })
          .should.equal(true)
      })

      it('should clear the project state from the docupdater', function() {
        return this.DocumentUpdaterHandler.clearProjectState
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })
  })

  describe('_buildRequest', function() {
    beforeEach(function() {
      this.project = {
        _id: this.project_id,
        compiler: (this.compiler = 'latex'),
        rootDoc_id: 'mock-doc-id-1',
        imageName: (this.image = 'mock-image-name')
      }

      this.docs = {
        '/main.tex': (this.doc_1 = {
          name: 'main.tex',
          _id: 'mock-doc-id-1',
          lines: ['Hello', 'world']
        }),
        '/chapters/chapter1.tex': (this.doc_2 = {
          name: 'chapter1.tex',
          _id: 'mock-doc-id-2',
          lines: ['Chapter 1']
        })
      }

      this.files = {
        '/images/image.png': (this.file_1 = {
          name: 'image.png',
          _id: 'mock-file-id-1',
          created: new Date()
        })
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
      return (this.DocumentUpdaterHandler.flushProjectToMongo = sinon
        .stub()
        .callsArgWith(1, null))
    })

    describe('with a valid project', function() {
      beforeEach(function(done) {
        return this.ClsiManager._buildRequest(
          this.project_id,
          { timeout: 100 },
          (error, request) => {
            this.request = request
            return done()
          }
        )
      })

      it('should get the project with the required fields', function() {
        return this.ProjectGetter.getProject
          .calledWith(this.project_id, {
            compiler: 1,
            rootDoc_id: 1,
            imageName: 1,
            rootFolder: 1
          })
          .should.equal(true)
      })

      it('should flush the project to the database', function() {
        return this.DocumentUpdaterHandler.flushProjectToMongo
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should get all the docs', function() {
        return this.ProjectEntityHandler.getAllDocs
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should get all the files', function() {
        return this.ProjectEntityHandler.getAllFiles
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should build up the CLSI request', function() {
        return expect(this.request).to.deep.equal({
          compile: {
            options: {
              compiler: this.compiler,
              timeout: 100,
              imageName: this.image,
              draft: false,
              check: undefined,
              syncType: undefined, // "full"
              syncState: undefined
            }, // "01234567890abcdef"
            rootResourcePath: 'main.tex',
            resources: [
              {
                path: 'main.tex',
                content: this.doc_1.lines.join('\n')
              },
              {
                path: 'chapters/chapter1.tex',
                content: this.doc_2.lines.join('\n')
              },
              {
                path: 'images/image.png',
                url: `${this.settings.apis.filestore.url}/project/${
                  this.project_id
                }/file/${this.file_1._id}`,
                modified: this.file_1.created.getTime()
              }
            ]
          }
        })
      })
    })

    describe('with the incremental compile option', function() {
      beforeEach(function(done) {
        this.ClsiStateManager.computeHash = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            (this.project_state_hash = '01234567890abcdef')
          )
        this.DocumentUpdaterHandler.getProjectDocsIfMatch = sinon
          .stub()
          .callsArgWith(2, null, [
            { _id: this.doc_1._id, lines: this.doc_1.lines, v: 123 }
          ])
        this.ProjectEntityHandler.getAllDocPathsFromProject = sinon
          .stub()
          .callsArgWith(1, null, { 'mock-doc-id-1': 'main.tex' })
        return this.ClsiManager._buildRequest(
          this.project_id,
          { timeout: 100, incrementalCompilesEnabled: true },
          (error, request) => {
            this.request = request
            return done()
          }
        )
      })

      it('should get the project with the required fields', function() {
        return this.ProjectGetter.getProject
          .calledWith(this.project_id, {
            compiler: 1,
            rootDoc_id: 1,
            imageName: 1,
            rootFolder: 1
          })
          .should.equal(true)
      })

      it('should not explicitly flush the project to the database', function() {
        return this.DocumentUpdaterHandler.flushProjectToMongo
          .calledWith(this.project_id)
          .should.equal(false)
      })

      it('should get only the live docs from the docupdater with a background flush in docupdater', function() {
        return this.DocumentUpdaterHandler.getProjectDocsIfMatch
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should not get any of the files', function() {
        return this.ProjectEntityHandler.getAllFiles.called.should.equal(false)
      })

      it('should build up the CLSI request', function() {
        return expect(this.request).to.deep.equal({
          compile: {
            options: {
              compiler: this.compiler,
              timeout: 100,
              imageName: this.image,
              draft: false,
              check: undefined,
              syncType: 'incremental',
              syncState: '01234567890abcdef'
            },
            rootResourcePath: 'main.tex',
            resources: [
              {
                path: 'main.tex',
                content: this.doc_1.lines.join('\n')
              }
            ]
          }
        })
      })

      describe('when the root doc is set and not in the docupdater', function() {
        beforeEach(function(done) {
          this.ClsiStateManager.computeHash = sinon
            .stub()
            .callsArgWith(
              2,
              null,
              (this.project_state_hash = '01234567890abcdef')
            )
          this.DocumentUpdaterHandler.getProjectDocsIfMatch = sinon
            .stub()
            .callsArgWith(2, null, [
              { _id: this.doc_1._id, lines: this.doc_1.lines, v: 123 }
            ])
          this.ProjectEntityHandler.getAllDocPathsFromProject = sinon
            .stub()
            .callsArgWith(1, null, {
              'mock-doc-id-1': 'main.tex',
              'mock-doc-id-2': '/chapters/chapter1.tex'
            })
          return this.ClsiManager._buildRequest(
            this.project_id,
            {
              timeout: 100,
              incrementalCompilesEnabled: true,
              rootDoc_id: 'mock-doc-id-2'
            },
            (error, request) => {
              this.request = request
              return done()
            }
          )
        })

        it('should still change the root path', function() {
          return this.request.compile.rootResourcePath.should.equal(
            'chapters/chapter1.tex'
          )
        })
      })
    })

    describe('when root doc override is valid', function() {
      beforeEach(function(done) {
        return this.ClsiManager._buildRequest(
          this.project_id,
          { rootDoc_id: 'mock-doc-id-2' },
          (error, request) => {
            this.request = request
            return done()
          }
        )
      })

      it('should change root path', function() {
        return this.request.compile.rootResourcePath.should.equal(
          'chapters/chapter1.tex'
        )
      })
    })

    describe('when root doc override is invalid', function() {
      beforeEach(function(done) {
        return this.ClsiManager._buildRequest(
          this.project_id,
          { rootDoc_id: 'invalid-id' },
          (error, request) => {
            this.request = request
            return done()
          }
        )
      })

      it('should fallback to default root doc', function() {
        return this.request.compile.rootResourcePath.should.equal('main.tex')
      })
    })

    describe('when the project has an invalid compiler', function() {
      beforeEach(function(done) {
        this.project.compiler = 'context'
        return this.ClsiManager._buildRequest(
          this.project,
          null,
          (error, request) => {
            this.request = request
            return done()
          }
        )
      })

      it('should set the compiler to pdflatex', function() {
        return this.request.compile.options.compiler.should.equal('pdflatex')
      })
    })

    describe('when there is no valid root document', function() {
      beforeEach(function(done) {
        this.project.rootDoc_id = 'not-valid'
        return this.ClsiManager._buildRequest(
          this.project,
          null,
          (error, request) => {
            this.error = error
            this.request = request
            return done()
          }
        )
      })

      it('should set to main.tex', function() {
        return this.request.compile.rootResourcePath.should.equal('main.tex')
      })
    })

    describe('when there is no valid root document and no main.tex document', function() {
      beforeEach(function() {
        this.project.rootDoc_id = 'not-valid'
        this.docs = {
          '/other.tex': (this.doc_1 = {
            name: 'other.tex',
            _id: 'mock-doc-id-1',
            lines: ['Hello', 'world']
          }),
          '/chapters/chapter1.tex': (this.doc_2 = {
            name: 'chapter1.tex',
            _id: 'mock-doc-id-2',
            lines: ['Chapter 1']
          })
        }
        this.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        return this.ClsiManager._buildRequest(this.project, null, this.callback)
      })

      it('should report an error', function() {
        return this.callback
          .calledWith(new Error('no main file specified'))
          .should.equal(true)
      })
    })

    describe('when there is no valid root document and a single document which is not main.tex', function() {
      beforeEach(function(done) {
        this.project.rootDoc_id = 'not-valid'
        this.docs = {
          '/other.tex': (this.doc_1 = {
            name: 'other.tex',
            _id: 'mock-doc-id-1',
            lines: ['Hello', 'world']
          })
        }
        this.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        return this.ClsiManager._buildRequest(
          this.project,
          null,
          (error, request) => {
            this.error = error
            this.request = request
            return done()
          }
        )
      })

      it('should set io to the only file', function() {
        return this.request.compile.rootResourcePath.should.equal('other.tex')
      })
    })

    describe('with the draft option', function() {
      it('should add the draft option into the request', function(done) {
        return this.ClsiManager._buildRequest(
          this.project_id,
          { timeout: 100, draft: true },
          (error, request) => {
            request.compile.options.draft.should.equal(true)
            return done()
          }
        )
      })
    })
  })

  describe('_postToClsi', function() {
    beforeEach(function() {
      return (this.req = { mock: 'req' })
    })

    describe('successfully', function() {
      beforeEach(function() {
        this.ClsiManager._makeRequest = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            { statusCode: 204 },
            (this.body = { mock: 'foo' })
          )
        return this.ClsiManager._postToClsi(
          this.project_id,
          this.user_id,
          this.req,
          'standard',
          this.callback
        )
      })

      it('should send the request to the CLSI', function() {
        const url = `${this.settings.apis.clsi.url}/project/${
          this.project_id
        }/user/${this.user_id}/compile`
        return this.ClsiManager._makeRequest
          .calledWith(this.project_id, {
            method: 'POST',
            url,
            json: this.req
          })
          .should.equal(true)
      })

      it('should call the callback with the body and no error', function() {
        return this.callback.calledWith(null, this.body).should.equal(true)
      })
    })

    describe('when the CLSI returns an error', function() {
      beforeEach(function() {
        this.ClsiManager._makeRequest = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            { statusCode: 500 },
            (this.body = { mock: 'foo' })
          )
        return this.ClsiManager._postToClsi(
          this.project_id,
          this.user_id,
          this.req,
          'standard',
          this.callback
        )
      })

      it('should call the callback with the body and the error', function() {
        return this.callback
          .calledWith(
            new Error('CLSI returned non-success code: 500'),
            this.body
          )
          .should.equal(true)
      })
    })
  })

  describe('wordCount', function() {
    beforeEach(function() {
      this.ClsiManager._makeRequest = sinon
        .stub()
        .callsArgWith(
          2,
          null,
          { statusCode: 200 },
          (this.body = { mock: 'foo' })
        )
      return (this.ClsiManager._buildRequest = sinon.stub().callsArgWith(
        2,
        null,
        (this.req = {
          compile: { rootResourcePath: 'rootfile.text', options: {} }
        })
      ))
    })

    describe('with root file', function() {
      beforeEach(function() {
        return this.ClsiManager.wordCount(
          this.project_id,
          this.user_id,
          false,
          {},
          this.callback
        )
      })

      it('should call wordCount with root file', function() {
        return this.ClsiManager._makeRequest
          .calledWith(this.project_id, {
            method: 'GET',
            url: `http://clsi.example.com/project/${this.project_id}/user/${
              this.user_id
            }/wordcount`,
            qs: { file: 'rootfile.text', image: undefined }
          })
          .should.equal(true)
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('with param file', function() {
      beforeEach(function() {
        return this.ClsiManager.wordCount(
          this.project_id,
          this.user_id,
          'main.tex',
          {},
          this.callback
        )
      })

      it('should call wordCount with param file', function() {
        return this.ClsiManager._makeRequest
          .calledWith(this.project_id, {
            method: 'GET',
            url: `http://clsi.example.com/project/${this.project_id}/user/${
              this.user_id
            }/wordcount`,
            qs: { file: 'main.tex', image: undefined }
          })
          .should.equal(true)
      })
    })

    describe('with image', function() {
      beforeEach(function() {
        this.req.compile.options.imageName = this.image =
          'example.com/mock/image'
        return this.ClsiManager.wordCount(
          this.project_id,
          this.user_id,
          'main.tex',
          {},
          this.callback
        )
      })

      it('should call wordCount with file and image', function() {
        return this.ClsiManager._makeRequest
          .calledWith(this.project_id, {
            method: 'GET',
            url: `http://clsi.example.com/project/${this.project_id}/user/${
              this.user_id
            }/wordcount`,
            qs: { file: 'main.tex', image: this.image }
          })
          .should.equal(true)
      })
    })
  })

  describe('_makeRequest', function() {
    beforeEach(function() {
      this.response = { there: 'something' }
      this.request.callsArgWith(1, null, this.response)
      return (this.opts = {
        method: 'SOMETHIGN',
        url: 'http://a place on the web'
      })
    })

    it('should process a request with a cookie jar', function(done) {
      return this.ClsiManager._makeRequest(this.project_id, this.opts, () => {
        const args = this.request.args[0]
        args[0].method.should.equal(this.opts.method)
        args[0].url.should.equal(this.opts.url)
        args[0].jar.should.equal(this.jar)
        return done()
      })
    })

    it('should set the cookie again on response as it might have changed', function(done) {
      return this.ClsiManager._makeRequest(this.project_id, this.opts, () => {
        this.ClsiCookieManager.setServerId
          .calledWith(this.project_id, this.response)
          .should.equal(true)
        return done()
      })
    })
  })

  describe('_makeGoogleCloudRequest', function() {
    beforeEach(function() {
      this.settings.apis.clsi_new = { url: 'https://compiles.somewhere.test' }
      this.response = { there: 'something' }
      this.request.callsArgWith(1, null, this.response)
      return (this.opts = {
        url: this.ClsiManager._getCompilerUrl(null, this.project_id)
      })
    })

    it('should change the domain on the url', function(done) {
      return this.ClsiManager._makeNewBackendRequest(
        this.project_id,
        this.opts,
        () => {
          const args = this.request.args[0]
          args[0].url.should.equal(
            `https://compiles.somewhere.test/project/${this.project_id}`
          )
          return done()
        }
      )
    })

    it('should not make a request if there is not clsi_new url', function(done) {
      this.settings.apis.clsi_new = undefined
      return this.ClsiManager._makeNewBackendRequest(
        this.project_id,
        this.opts,
        err => {
          expect(err).to.equal(undefined)
          this.request.callCount.should.equal(0)
          return done()
        }
      )
    })
  })
})
