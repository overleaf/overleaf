const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const { expect } = require('chai')
const { ObjectId } = require('mongodb-legacy')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler'
)

describe('DocumentUpdaterHandler', function () {
  beforeEach(function () {
    this.project_id = 'project-id-923'
    this.projectHistoryId = 'ol-project-id-1'
    this.doc_id = 'doc-id-394'
    this.lines = ['one', 'two', 'three']
    this.version = 42
    this.user_id = 'mock-user-id-123'
    this.project = { _id: this.project_id }

    this.request = sinon.stub()
    this.projectEntityHandler = {}
    this.settings = {
      apis: {
        documentupdater: {
          url: 'http://document_updater.example.com',
        },
        project_history: {
          url: 'http://project_history.example.com',
        },
      },
      filestoreMigrationLevel: 0,
      moduleImportSequence: [],
    }
    this.source = 'dropbox'

    this.handler = SandboxedModule.require(modulePath, {
      requires: {
        request: {
          defaults: () => {
            return this.request
          },
        },
        '@overleaf/settings': this.settings,
        '../Project/ProjectEntityHandler': this.projectEntityHandler,
        '../../models/Project': {
          Project: (this.Project = {}),
        },
        '../Project/ProjectGetter': (this.ProjectGetter = {
          getProjectWithoutLock: sinon.stub(),
        }),
        '../../Features/Project/ProjectLocator': {},
        '@overleaf/metrics': {
          Timer: class {
            done() {}
          },
        },
        '../FileStore/FileStoreHandler': {
          _buildUrl: sinon.stub().callsFake((projectId, fileId) => {
            return `http://filestore/project/${projectId}/file/${fileId}`
          }),
        },
        '../../infrastructure/Modules': {
          promises: {
            hooks: {
              fire: sinon.stub().resolves(),
            },
          },
        },
      },
    })
    this.ProjectGetter.getProjectWithoutLock
      .withArgs(this.project_id)
      .yields(null, this.project)
  })

  describe('flushProjectToMongo', function () {
    describe('successfully', function () {
      beforeEach(async function () {
        this.request.callsArgWith(1, null, { statusCode: 204 }, '')
        await this.handler.promises.flushProjectToMongo(this.project_id)
      })

      it('should flush the document from the document updater', function () {
        this.request
          .calledWithMatch({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/flush`,
            method: 'POST',
          })
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          new Error('something went wrong'),
          null,
          null
        )
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.flushProjectToMongo(this.project_id)
        } catch (err) {
          error = err
        }

        expect(error).to.exist
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.flushProjectToMongo(this.project_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'document updater returned a failure status code: 500'
        )
      })
    })
  })

  describe('flushProjectToMongoAndDelete', function () {
    describe('successfully', function () {
      beforeEach(async function () {
        this.request.callsArgWith(1, null, { statusCode: 204 }, '')
        await this.handler.promises.flushProjectToMongoAndDelete(
          this.project_id
        )
      })

      it('should delete the project from the document updater', function () {
        this.request
          .calledWithMatch({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}`,
            method: 'DELETE',
          })
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          new Error('something went wrong'),
          null,
          null
        )
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.flushProjectToMongoAndDelete(
            this.project_id
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.flushProjectToMongoAndDelete(
            this.project_id
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'document updater returned a failure status code: 500'
        )
      })
    })
  })

  describe('flushDocToMongo', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 204 }, '')
      })

      it('should flush the document from the document updater', async function () {
        await this.handler.promises.flushDocToMongo(
          this.project_id,
          this.doc_id
        )
        this.request
          .calledWithMatch({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}/flush`,
            method: 'POST',
          })
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          new Error('something went wrong'),
          null,
          null
        )
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.flushDocToMongo(
            this.project_id,
            this.doc_id
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.flushDocToMongo(
            this.project_id,
            this.doc_id
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'document updater returned a failure status code: 500'
        )
      })
    })
  })

  describe('deleteDoc', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 204 }, '')
      })

      it('should delete the document from the document updater', async function () {
        await this.handler.promises.deleteDoc(this.project_id, this.doc_id)
        this.request
          .calledWithMatch({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}`,
            method: 'DELETE',
          })
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          new Error('something went wrong'),
          null,
          null
        )
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.deleteDoc(this.project_id, this.doc_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.deleteDoc(this.project_id, this.doc_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'document updater returned a failure status code: 500'
        )
      })
    })

    describe("with 'ignoreFlushErrors' option", function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 204 }, '')
      })

      it('when option is true, should send a `ignore_flush_errors=true` URL query to document-updater', async function () {
        await this.handler.promises.deleteDoc(
          this.project_id,
          this.doc_id,
          true
        )
        this.request
          .calledWithMatch({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}?ignore_flush_errors=true`,
            method: 'DELETE',
          })
          .should.equal(true)
      })

      it("when option is false, shouldn't send any URL query to document-updater", async function () {
        await this.handler.promises.deleteDoc(
          this.project_id,
          this.doc_id,
          false
        )
        this.request
          .calledWithMatch({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}`,
            method: 'DELETE',
          })
          .should.equal(true)
      })
    })
  })

  describe('setDocument', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 204 }, '')
      })

      it('should set the document in the document updater', async function () {
        await this.handler.promises.setDocument(
          this.project_id,
          this.doc_id,
          this.user_id,
          this.lines,
          this.source
        )
        this.request
          .calledWith({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}`,
            json: {
              lines: this.lines,
              source: this.source,
              user_id: this.user_id,
            },
            method: 'POST',
            timeout: 30 * 1000,
          })
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          new Error('something went wrong'),
          null,
          null
        )
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.setDocument(
            this.project_id,
            this.doc_id,
            this.user_id,
            this.lines,
            this.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.setDocument(
            this.project_id,
            this.doc_id,
            this.user_id,
            this.lines,
            this.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'document updater returned a failure status code: 500'
        )
      })
    })
  })

  describe('getComment', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.comment = {
          id: 'mock-comment-id-1',
        }
        this.body = this.comment
        this.request.callsArgWith(1, null, { statusCode: 200 }, this.body)
      })

      it('should get the comment from the document updater', async function () {
        await this.handler.promises.getComment(
          this.project_id,
          this.doc_id,
          this.comment.id
        )
        const url = `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}/comment/${this.comment.id}`
        this.request
          .calledWith({
            url,
            method: 'GET',
            json: true,
            timeout: 30 * 1000,
          })
          .should.equal(true)
      })
    })
  })

  describe('getDocument', function () {
    describe('successfully', function () {
      let getDocumentResponse
      beforeEach(async function () {
        this.body = {
          lines: this.lines,
          version: this.version,
          ops: (this.ops = ['mock-op-1', 'mock-op-2']),
          ranges: (this.ranges = { mock: 'ranges' }),
        }
        this.fromVersion = 2
        this.request.callsArgWith(1, null, { statusCode: 200 }, this.body)
        getDocumentResponse = await this.handler.promises.getDocument(
          this.project_id,
          this.doc_id,
          this.fromVersion
        )
      })

      it('should get the document from the document updater', function () {
        this.request
          .calledWith({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}?fromVersion=${this.fromVersion}`,
            method: 'GET',
            json: true,
            timeout: 30 * 1000,
          })
          .should.equal(true)
      })

      it('should call the callback with the lines and version', function () {
        expect(getDocumentResponse).to.eql({
          lines: this.lines,
          version: this.version,
          ranges: this.ranges,
          ops: this.ops,
        })
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          new Error('something went wrong'),
          null,
          null
        )
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.getDocument(
            this.project_id,
            this.doc_id,
            this.fromVersion
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.getDocument(
            this.project_id,
            this.doc_id,
            this.fromVersion
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'document updater returned a failure status code: 500'
        )
      })
    })
  })

  describe('getProjectDocsIfMatch', function () {
    beforeEach(function () {
      this.project_state_hash = '1234567890abcdef'
    })

    describe('successfully', function () {
      let getProjectDocsIfMatchResponse
      beforeEach(async function () {
        this.doc0 = {
          _id: this.doc_id,
          lines: this.lines,
          v: this.version,
        }
        this.docs = [this.doc0, this.doc0, this.doc0]
        this.body = JSON.stringify(this.docs)
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 200 }, this.body)
        getProjectDocsIfMatchResponse =
          await this.handler.promises.getProjectDocsIfMatch(
            this.project_id,
            this.project_state_hash
          )
      })

      it('should get the documents from the document updater', function () {
        const url = `${this.settings.apis.documentupdater.url}/project/${this.project_id}/get_and_flush_if_old?state=${this.project_state_hash}`
        this.request.post.calledWith(url).should.equal(true)
      })

      it('should call the callback with the documents', function () {
        expect(getProjectDocsIfMatchResponse).to.eql(this.docs)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, new Error('something went wrong'), null, null)
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.getProjectDocsIfMatch(
            this.project_id,
            this.project_state_hash
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('when the document updater returns a conflict error code', function () {
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 409 }, 'Conflict')
      })

      it('should return no documents', async function () {
        const response = await this.handler.promises.getProjectDocsIfMatch(
          this.project_id,
          this.project_state_hash
        )
        expect(response).to.be.undefined
      })
    })
  })

  describe('clearProjectState', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 200 })
      })

      it('should clear the project state from the document updater', async function () {
        await this.handler.promises.clearProjectState(this.project_id)

        this.request
          .calledWithMatch({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/clearState`,
            method: 'POST',
          })
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          new Error('something went wrong'),
          null,
          null
        )
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.clearProjectState(this.project_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('when the document updater returns an error code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, null)
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.clearProjectState(this.project_id)
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'document updater returned a failure status code: 500'
        )
      })
    })
  })

  describe('acceptChanges', function () {
    beforeEach(function () {
      this.change_id = 'mock-change-id-1'
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 200 }, this.body)
      })

      it('should accept the change in the document updater', async function () {
        await this.handler.promises.acceptChanges(
          this.project_id,
          this.doc_id,
          [this.change_id]
        )
        this.request
          .calledWith({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}/change/accept`,
            json: {
              change_ids: [this.change_id],
            },
            method: 'POST',
            timeout: 30 * 1000,
          })
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          new Error('something went wrong'),
          null,
          null
        )
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.acceptChanges(
            this.project_id,
            this.doc_id,
            [this.change_id]
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.acceptChanges(
            this.project_id,
            this.doc_id,
            [this.change_id]
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'document updater returned a failure status code: 500'
        )
      })
    })
  })

  describe('deleteThread', function () {
    beforeEach(function () {
      this.thread_id = 'mock-thread-id-1'
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 200 }, this.body)
      })

      it('should delete the thread in the document updater', async function () {
        await this.handler.promises.deleteThread(
          this.project_id,
          this.doc_id,
          this.thread_id,
          this.user_id
        )
        this.request
          .calledWithMatch({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}/comment/${this.thread_id}`,
            method: 'DELETE',
          })
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          new Error('something went wrong'),
          null,
          null
        )
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.deleteThread(
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.user_id
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.deleteThread(
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.user_id
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'document updater returned a failure status code: 500'
        )
      })
    })
  })

  describe('resolveThread', function () {
    beforeEach(function () {
      this.thread_id = 'mock-thread-id-1'
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 200 }, this.body)
      })

      it('should resolve the thread in the document updater', async function () {
        await this.handler.promises.resolveThread(
          this.project_id,
          this.doc_id,
          this.thread_id,
          this.user_id
        )
        this.request
          .calledWithMatch({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}/comment/${this.thread_id}/resolve`,
            method: 'POST',
          })
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          new Error('something went wrong'),
          null,
          null
        )
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.resolveThread(
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.user_id
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.resolveThread(
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.user_id
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'document updater returned a failure status code: 500'
        )
      })
    })
  })

  describe('reopenThread', function () {
    beforeEach(function () {
      this.thread_id = 'mock-thread-id-1'
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 200 }, this.body)
      })

      it('should reopen the thread in the document updater', async function () {
        await this.handler.promises.reopenThread(
          this.project_id,
          this.doc_id,
          this.thread_id,
          this.user_id
        )
        this.request
          .calledWithMatch({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}/comment/${this.thread_id}/reopen`,
            method: 'POST',
          })
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          new Error('something went wrong'),
          null,
          null
        )
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.reopenThread(
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.user_id
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.reopenThread(
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.user_id
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'document updater returned a failure status code: 500'
        )
      })
    })
  })

  describe('updateProjectStructure ', function () {
    beforeEach(function () {
      this.user_id = 1234
      this.version = 999
    })

    describe('with project history disabled', function () {
      beforeEach(function () {
        this.settings.apis.project_history.sendProjectStructureOps = false
      })

      it('does not make a web request', async function () {
        await this.handler.promises.updateProjectStructure(
          this.project_id,
          this.projectHistoryId,
          this.user_id,
          {},
          this.source
        )
        this.request.called.should.equal(false)
      })
    })

    describe('with project history enabled', function () {
      beforeEach(function () {
        this.settings.apis.project_history.sendProjectStructureOps = true
        this.url = `${this.settings.apis.documentupdater.url}/project/${this.project_id}`
        this.request.callsArgWith(1, null, { statusCode: 204 }, '')
      })

      describe('when an entity has changed name', function () {
        it('should send the structure update to the document updater', async function () {
          this.docIdA = new ObjectId()
          this.docIdB = new ObjectId()
          this.changes = {
            oldDocs: [
              { path: '/old_a', doc: { _id: this.docIdA } },
              { path: '/old_b', doc: { _id: this.docIdB } },
            ],
            // create new instances of the same ObjectIds so that == doesn't pass
            newDocs: [
              {
                path: '/old_a',
                doc: { _id: new ObjectId(this.docIdA.toString()) },
              },
              {
                path: '/new_b',
                doc: { _id: new ObjectId(this.docIdB.toString()) },
              },
            ],
            newProject: { version: this.version },
          }

          const updates = [
            {
              type: 'rename-doc',
              id: this.docIdB.toString(),
              pathname: '/old_b',
              newPathname: '/new_b',
            },
          ]

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.changes,
            this.source
          )

          this.request
            .calledWith({
              url: this.url,
              method: 'POST',
              json: {
                updates,
                userId: this.user_id,
                version: this.version,
                projectHistoryId: this.projectHistoryId,
                source: this.source,
              },
              timeout: 30 * 1000,
            })
            .should.equal(true)
        })
      })

      describe('when a doc has been added', function () {
        it('should send the structure update to the document updater', async function () {
          this.docId = new ObjectId()
          this.changes = {
            newDocs: [
              { path: '/foo', docLines: 'a\nb', doc: { _id: this.docId } },
            ],
            newProject: { version: this.version },
          }

          const updates = [
            {
              type: 'add-doc',
              id: this.docId.toString(),
              pathname: '/foo',
              docLines: 'a\nb',
              historyRangesSupport: false,
              url: undefined,
              hash: undefined,
              ranges: undefined,
              metadata: undefined,
              createdBlob: false,
            },
          ]

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.changes,
            this.source
          )

          this.request.should.have.been.calledWith({
            url: this.url,
            method: 'POST',
            json: {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            },
            timeout: 30 * 1000,
          })
        })
      })

      describe('when a file has been added', function () {
        it('should send the structure update to the document updater', async function () {
          this.fileId = new ObjectId()
          this.changes = {
            newFiles: [
              {
                path: '/bar',
                url: 'filestore.example.com/file',
                file: { _id: this.fileId, hash: '12345' },
              },
            ],
            newProject: { version: this.version },
          }

          const updates = [
            {
              type: 'add-file',
              id: this.fileId.toString(),
              pathname: '/bar',
              url: 'filestore.example.com/file',
              docLines: undefined,
              historyRangesSupport: false,
              hash: '12345',
              ranges: undefined,
              createdBlob: false,
              metadata: undefined,
            },
          ]

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.changes,
            this.source
          )

          this.request.should.have.been.calledWith({
            url: this.url,
            method: 'POST',
            json: {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            },
            timeout: 30 * 1000,
          })
        })
      })

      describe('when an entity has been deleted', function () {
        it('should end the structure update to the document updater', async function () {
          this.docId = new ObjectId()
          this.changes = {
            oldDocs: [
              { path: '/foo', docLines: 'a\nb', doc: { _id: this.docId } },
            ],
            newProject: { version: this.version },
          }

          const updates = [
            {
              type: 'rename-doc',
              id: this.docId.toString(),
              pathname: '/foo',
              newPathname: '',
            },
          ]

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.changes,
            this.source
          )

          this.request.should.have.been.calledWith({
            url: this.url,
            method: 'POST',
            json: {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            },
            timeout: 30 * 1000,
          })
        })
      })

      describe('when a file is converted to a doc', function () {
        it('should send the delete first', async function () {
          this.docId = new ObjectId()
          this.fileId = new ObjectId()
          this.changes = {
            oldFiles: [
              {
                path: '/foo.doc',
                url: 'filestore.example.com/file',
                file: { _id: this.fileId },
              },
            ],
            newDocs: [
              {
                path: '/foo.doc',
                docLines: 'hello there',
                doc: { _id: this.docId },
              },
            ],
            newProject: { version: this.version },
          }

          const updates = [
            {
              type: 'rename-file',
              id: this.fileId.toString(),
              pathname: '/foo.doc',
              newPathname: '',
            },
            {
              type: 'add-doc',
              id: this.docId.toString(),
              pathname: '/foo.doc',
              docLines: 'hello there',
              historyRangesSupport: false,
              url: undefined,
              hash: undefined,
              ranges: undefined,
              metadata: undefined,
              createdBlob: false,
            },
          ]

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.changes,
            this.source
          )

          this.request.should.have.been.calledWith({
            url: this.url,
            method: 'POST',
            json: {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            },
            timeout: 30 * 1000,
          })
        })
      })

      describe('when the project version is missing', function () {
        it('should call the callback with an error', async function () {
          this.docId = new ObjectId()
          this.changes = {
            oldDocs: [
              { path: '/foo', docLines: 'a\nb', doc: { _id: this.docId } },
            ],
          }

          let error

          try {
            await this.handler.promises.updateProjectStructure(
              this.project_id,
              this.projectHistoryId,
              this.user_id,
              this.changes,
              this.source
            )
          } catch (err) {
            error = err
          }

          expect(error).to.be.instanceOf(Error)
          expect(error).to.have.property(
            'message',
            'did not receive project version in changes'
          )
        })
      })

      describe('when ranges are present', function () {
        beforeEach(function () {
          this.docId = new ObjectId()
          this.ranges = {
            changes: [
              {
                op: { p: 0, i: 'foo' },
                metadata: { ts: '2024-01-01T00:00:00.000Z', user_id: 'user-1' },
              },
              {
                op: { p: 7, d: ' baz' },
                metadata: { ts: '2024-02-01T00:00:00.000Z', user_id: 'user-1' },
              },
            ],
            comments: [
              {
                op: { p: 4, c: 'bar', t: 'comment-1' },
                metadata: { resolved: false },
              },
            ],
          }
          this.changes = {
            newDocs: [
              {
                path: '/foo',
                docLines: 'foo\nbar',
                doc: { _id: this.docId },
                ranges: this.ranges,
              },
            ],
            newProject: { version: this.version },
          }
        })

        it('should forward ranges', async function () {
          const updates = [
            {
              type: 'add-doc',
              id: this.docId.toString(),
              pathname: '/foo',
              docLines: 'foo\nbar',
              historyRangesSupport: false,
              url: undefined,
              hash: undefined,
              ranges: this.ranges,
              metadata: undefined,
              createdBlob: false,
            },
          ]

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.changes,
            this.source
          )

          this.request.should.have.been.calledWith({
            url: this.url,
            method: 'POST',
            json: {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            },
            timeout: 30 * 1000,
          })
        })

        it('should include flag when history ranges support is enabled', async function () {
          this.ProjectGetter.getProjectWithoutLock
            .withArgs(this.project_id)
            .yields(null, {
              _id: this.project_id,
              overleaf: { history: { rangesSupportEnabled: true } },
            })

          const updates = [
            {
              type: 'add-doc',
              id: this.docId.toString(),
              pathname: '/foo',
              docLines: 'foo\nbar',
              historyRangesSupport: true,
              url: undefined,
              hash: undefined,
              ranges: this.ranges,
              metadata: undefined,
              createdBlob: false,
            },
          ]

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.changes,
            this.source
          )

          this.request.should.have.been.calledWith({
            url: this.url,
            method: 'POST',
            json: {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            },
            timeout: 30 * 1000,
          })
        })
      })

      describe('with filestore disabled', function () {
        beforeEach(function () {
          this.settings.filestoreMigrationLevel = 2
        })
        it('should add files without URL and with createdBlob', async function () {
          this.fileId = new ObjectId()
          this.changes = {
            newFiles: [
              {
                path: '/bar',
                url: 'filestore.example.com/file',
                file: { _id: this.fileId, hash: '12345' },
              },
            ],
            newProject: { version: this.version },
          }

          const updates = [
            {
              type: 'add-file',
              id: this.fileId.toString(),
              pathname: '/bar',
              docLines: undefined,
              historyRangesSupport: false,
              url: undefined,
              hash: '12345',
              ranges: undefined,
              createdBlob: true,
              metadata: undefined,
            },
          ]

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.changes,
            this.source
          )

          this.request.should.have.been.calledWith({
            url: this.url,
            method: 'POST',
            json: {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            },
            timeout: 30 * 1000,
          })
        })
        it('should flag files without hash', async function () {
          this.fileId = new ObjectId()
          this.changes = {
            newFiles: [
              {
                path: '/bar',
                url: 'filestore.example.com/file',
                file: { _id: this.fileId },
              },
            ],
            newProject: { version: this.version },
          }

          let error
          try {
            await this.handler.promises.updateProjectStructure(
              this.project_id,
              this.projectHistoryId,
              this.user_id,
              this.changes,
              this.source
            )
          } catch (err) {
            error = err
          }
          expect(error).to.exist
        })
      })
    })
  })

  describe('resyncProjectHistory', function () {
    it('should add docs', async function () {
      const docId1 = new ObjectId()
      const docId2 = new ObjectId()
      const docs = [
        { doc: { _id: docId1 }, path: 'main.tex' },
        { doc: { _id: docId2 }, path: 'references.bib' },
      ]
      const files = []
      this.request.yields(null, { statusCode: 200 })
      const projectId = new ObjectId()
      const projectHistoryId = 99
      await this.handler.promises.resyncProjectHistory(
        projectId,
        projectHistoryId,
        docs,
        files,
        {}
      )
      this.request.should.have.been.calledWith({
        url: `${this.settings.apis.documentupdater.url}/project/${projectId}/history/resync`,
        method: 'POST',
        json: {
          docs: [
            { doc: docId1, path: 'main.tex' },
            { doc: docId2, path: 'references.bib' },
          ],
          files: [],
          projectHistoryId,
        },
        timeout: 6 * 60 * 1000,
      })
    })
    it('should add files', async function () {
      const fileId1 = new ObjectId()
      const fileId2 = new ObjectId()
      const fileId3 = new ObjectId()
      const fileCreated2 = new Date()
      const fileCreated3 = new Date()
      const otherProjectId = new ObjectId().toString()
      const files = [
        { file: { _id: fileId1, hash: '42' }, path: '1.png' },
        {
          file: {
            _id: fileId2,
            hash: '1337',
            created: fileCreated2,
            linkedFileData: {
              provider: 'references-provider',
            },
          },
          path: '1.bib',
        },
        {
          file: {
            _id: fileId3,
            hash: '21',
            created: fileCreated3,
            linkedFileData: {
              provider: 'project_output_file',
              build_id: '1234-abc',
              clsiServerId: 'server-1',
              source_project_id: otherProjectId,
              source_output_file_path: 'foo/bar.txt',
            },
          },
          path: 'bar.txt',
        },
      ]
      const docs = []
      this.request.yields(null, { statusCode: 200 })
      const projectId = new ObjectId()
      const projectHistoryId = 99
      await this.handler.promises.resyncProjectHistory(
        projectId,
        projectHistoryId,
        docs,
        files,
        {}
      )
      this.request.should.have.been.calledWith({
        url: `${this.settings.apis.documentupdater.url}/project/${projectId}/history/resync`,
        method: 'POST',
        json: {
          docs: [],
          files: [
            {
              file: fileId1,
              _hash: '42',
              path: '1.png',
              url: `http://filestore/project/${projectId}/file/${fileId1}`,
              createdBlob: false,
              metadata: undefined,
            },
            {
              file: fileId2,
              _hash: '1337',
              path: '1.bib',
              url: `http://filestore/project/${projectId}/file/${fileId2}`,
              createdBlob: false,
              metadata: {
                importedAt: fileCreated2,
                provider: 'references-provider',
              },
            },
            {
              file: fileId3,
              _hash: '21',
              path: 'bar.txt',
              url: `http://filestore/project/${projectId}/file/${fileId3}`,
              createdBlob: false,
              metadata: {
                importedAt: fileCreated3,
                provider: 'project_output_file',
                source_project_id: otherProjectId,
                source_output_file_path: 'foo/bar.txt',
                // build_id and clsiServerId are omitted
              },
            },
          ],
          projectHistoryId,
        },
        timeout: 6 * 60 * 1000,
      })
    })
    describe('with filestore disabled', function () {
      beforeEach(function () {
        this.settings.filestoreMigrationLevel = 2
      })
      it('should add files without URL', async function () {
        const fileId1 = new ObjectId()
        const fileId2 = new ObjectId()
        const fileId3 = new ObjectId()
        const fileCreated2 = new Date()
        const fileCreated3 = new Date()
        const otherProjectId = new ObjectId().toString()
        const files = [
          { file: { _id: fileId1, hash: '42' }, path: '1.png' },
          {
            file: {
              _id: fileId2,
              hash: '1337',
              created: fileCreated2,
              linkedFileData: {
                provider: 'references-provider',
              },
            },
            path: '1.bib',
          },
          {
            file: {
              _id: fileId3,
              hash: '21',
              created: fileCreated3,
              linkedFileData: {
                provider: 'project_output_file',
                build_id: '1234-abc',
                clsiServerId: 'server-1',
                source_project_id: otherProjectId,
                source_output_file_path: 'foo/bar.txt',
              },
            },
            path: 'bar.txt',
          },
        ]
        const docs = []
        this.request.yields(null, { statusCode: 200 })
        const projectId = new ObjectId()
        const projectHistoryId = 99
        await this.handler.promises.resyncProjectHistory(
          projectId,
          projectHistoryId,
          docs,
          files,
          {}
        )
        this.request.should.have.been.calledWith({
          url: `${this.settings.apis.documentupdater.url}/project/${projectId}/history/resync`,
          method: 'POST',
          json: {
            docs: [],
            files: [
              {
                file: fileId1,
                _hash: '42',
                path: '1.png',
                url: undefined,
                createdBlob: true,
                metadata: undefined,
              },
              {
                file: fileId2,
                _hash: '1337',
                path: '1.bib',
                url: undefined,
                createdBlob: true,
                metadata: {
                  importedAt: fileCreated2,
                  provider: 'references-provider',
                },
              },
              {
                file: fileId3,
                _hash: '21',
                path: 'bar.txt',
                url: undefined,
                createdBlob: true,
                metadata: {
                  importedAt: fileCreated3,
                  provider: 'project_output_file',
                  source_project_id: otherProjectId,
                  source_output_file_path: 'foo/bar.txt',
                  // build_id and clsiServerId are omitted
                },
              },
            ],
            projectHistoryId,
          },
          timeout: 6 * 60 * 1000,
        })
      })
      it('should flag files with missing hashes', async function () {
        const fileId1 = new ObjectId()
        const fileId2 = new ObjectId()
        const fileId3 = new ObjectId()
        const fileCreated2 = new Date()
        const fileCreated3 = new Date()
        const otherProjectId = new ObjectId().toString()
        const files = [
          { file: { _id: fileId1, hash: '42' }, path: '1.png' },
          {
            file: {
              _id: fileId2,
              created: fileCreated2,
              linkedFileData: {
                provider: 'references-provider',
              },
            },
            path: '1.bib',
          },
          {
            file: {
              _id: fileId3,
              hash: '21',
              created: fileCreated3,
              linkedFileData: {
                provider: 'project_output_file',
                build_id: '1234-abc',
                clsiServerId: 'server-1',
                source_project_id: otherProjectId,
                source_output_file_path: 'foo/bar.txt',
              },
            },
            path: 'bar.txt',
          },
        ]
        const docs = []
        this.request.yields(null, { statusCode: 200 })
        const projectId = new ObjectId()
        const projectHistoryId = 99
        await expect(
          this.handler.promises.resyncProjectHistory(
            projectId,
            projectHistoryId,
            docs,
            files,
            {}
          )
        ).to.be.rejected
      })
    })
  })

  describe('appendToDocument', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.body = {
          rev: 1,
        }
        this.request.callsArgWith(1, null, { statusCode: 200 }, this.body)
      })

      it('should append to the document in the document updater', async function () {
        await this.handler.promises.appendToDocument(
          this.project_id,
          this.doc_id,
          this.user_id,
          this.lines,
          this.source
        )
        this.request
          .calledWith({
            url: `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}/append`,
            json: {
              lines: this.lines,
              source: this.source,
              user_id: this.user_id,
            },
            method: 'POST',
            timeout: 30 * 1000,
          })
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.callsArgWith(
          1,
          new Error('something went wrong'),
          null,
          null
        )
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.appendToDocument(
            this.project_id,
            this.doc_id,
            this.user_id,
            this.lines,
            this.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 500 }, '')
      })

      it('should reject with an error', async function () {
        let error

        try {
          await this.handler.promises.appendToDocument(
            this.project_id,
            this.doc_id,
            this.user_id,
            this.lines,
            this.source
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Error)
        expect(error).to.have.property(
          'message',
          'document updater returned a failure status code: 500'
        )
      })
    })
  })
})
