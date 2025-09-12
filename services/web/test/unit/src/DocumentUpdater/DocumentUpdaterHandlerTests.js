const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const { expect } = require('chai')
const { ObjectId } = require('mongodb-legacy')
const nock = require('nock')
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
      moduleImportSequence: [],
    }
    this.source = 'dropbox'
    this.docUpdaterMock = nock(this.settings.apis.documentupdater.url)

    this.ProjectGetter = {
      promises: {
        getProjectWithoutLock: sinon.stub(),
      },
    }
    this.ProjectGetter.promises.getProjectWithoutLock
      .withArgs(this.project_id)
      .resolves(this.project)

    this.handler = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        '../Project/ProjectEntityHandler': this.projectEntityHandler,
        '../../models/Project': {
          Project: (this.Project = {}),
        },
        '../Project/ProjectGetter': this.ProjectGetter,
        '../../Features/Project/ProjectLocator': {},
        '@overleaf/metrics': {
          Timer: class {
            done() {}
          },
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
  })

  afterEach(function () {
    nock.cleanAll()
  })

  describe('flushProjectToMongo', function () {
    describe('successfully', function () {
      beforeEach(async function () {
        this.docUpdaterMock.post(`/project/${this.project_id}/flush`).reply(204)
        await this.handler.promises.flushProjectToMongo(this.project_id)
      })

      it('should flush the document from the document updater', function () {
        expect(this.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/flush`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(this.handler.promises.flushProjectToMongo(this.project_id))
          .to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.docUpdaterMock.post(`/project/${this.project_id}/flush`).reply(500)
      })

      it('should reject with an error', async function () {
        await expect(this.handler.promises.flushProjectToMongo(this.project_id))
          .to.be.rejected
      })
    })
  })

  describe('flushProjectToMongoAndDelete', function () {
    describe('successfully', function () {
      beforeEach(async function () {
        this.docUpdaterMock.delete(`/project/${this.project_id}`).reply(204)
        await this.handler.promises.flushProjectToMongoAndDelete(
          this.project_id
        )
      })

      it('should delete the project from the document updater', function () {
        expect(this.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .delete(`/project/${this.project_id}`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.flushProjectToMongoAndDelete(this.project_id)
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.docUpdaterMock.delete(`/project/${this.project_id}`).reply(500)
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.flushProjectToMongoAndDelete(this.project_id)
        ).to.be.rejected
      })
    })
  })

  describe('flushDocToMongo', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/doc/${this.doc_id}/flush`)
          .reply(204)
      })

      it('should flush the document from the document updater', async function () {
        await this.handler.promises.flushDocToMongo(
          this.project_id,
          this.doc_id
        )
        expect(this.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/doc/${this.doc_id}/flush`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.flushDocToMongo(this.project_id, this.doc_id)
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/doc/${this.doc_id}/flush`)
          .reply(500)
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.flushDocToMongo(this.project_id, this.doc_id)
        ).to.be.rejected
      })
    })
  })

  describe('deleteDoc', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .delete(`/project/${this.project_id}/doc/${this.doc_id}`)
          .reply(204)
      })

      it('should delete the document from the document updater', async function () {
        await this.handler.promises.deleteDoc(this.project_id, this.doc_id)
        expect(this.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .delete(`/project/${this.project_id}/doc/${this.doc_id}`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.deleteDoc(this.project_id, this.doc_id)
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .delete(`/project/${this.project_id}/doc/${this.doc_id}`)
          .reply(500)
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.deleteDoc(this.project_id, this.doc_id)
        ).to.be.rejected
      })
    })

    describe("with 'ignoreFlushErrors' option", function () {
      it('when option is true, should send a `ignore_flush_errors=true` URL query to document-updater', async function () {
        this.docUpdaterMock
          .delete(
            `/project/${this.project_id}/doc/${this.doc_id}?ignore_flush_errors=true`
          )
          .reply(204)
        await this.handler.promises.deleteDoc(
          this.project_id,
          this.doc_id,
          true
        )
        expect(this.docUpdaterMock.isDone()).to.be.true
      })

      it("when option is false, shouldn't send any URL query to document-updater", async function () {
        this.docUpdaterMock
          .delete(`/project/${this.project_id}/doc/${this.doc_id}`)
          .reply(204)
        await this.handler.promises.deleteDoc(
          this.project_id,
          this.doc_id,
          false
        )
        expect(this.docUpdaterMock.isDone()).to.be.true
      })
    })
  })

  describe('setDocument', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/doc/${this.doc_id}`, {
            lines: this.lines,
            source: this.source,
            user_id: this.user_id,
          })
          .reply(204)
      })

      it('should set the document in the document updater', async function () {
        await this.handler.promises.setDocument(
          this.project_id,
          this.doc_id,
          this.user_id,
          this.lines,
          this.source
        )
        expect(this.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/doc/${this.doc_id}`, {
            lines: this.lines,
            source: this.source,
            user_id: this.user_id,
          })
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.setDocument(
            this.project_id,
            this.doc_id,
            this.user_id,
            this.lines,
            this.source
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/doc/${this.doc_id}`, {
            lines: this.lines,
            source: this.source,
            user_id: this.user_id,
          })
          .reply(500)
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.setDocument(
            this.project_id,
            this.doc_id,
            this.user_id,
            this.lines,
            this.source
          )
        ).to.be.rejected
      })
    })
  })

  describe('getComment', function () {
    beforeEach(function () {
      this.comment = { id: new ObjectId().toString() }
      this.docUpdaterMock
        .get(
          `/project/${this.project_id}/doc/${this.doc_id}/comment/${this.comment.id}`
        )
        .reply(200, this.comment)
    })

    it('should get the comment from the document updater', async function () {
      const body = await this.handler.promises.getComment(
        this.project_id,
        this.doc_id,
        this.comment.id
      )
      expect(body).to.deep.equal(this.comment)
    })
  })

  describe('getDocument', function () {
    beforeEach(function () {
      this.doc = {
        lines: this.lines,
        version: this.version,
        ops: ['mock-op-1', 'mock-op-2'],
        ranges: { mock: 'ranges' },
      }
      this.fromVersion = 2
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .get(
            `/project/${this.project_id}/doc/${this.doc_id}?fromVersion=${this.fromVersion}`
          )
          .reply(200, this.doc)
      })

      it('should return the lines and version', async function () {
        const doc = await this.handler.promises.getDocument(
          this.project_id,
          this.doc_id,
          this.fromVersion
        )
        expect(doc).to.deep.equal(this.doc)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .get(
            `/project/${this.project_id}/doc/${this.doc_id}?fromVersion=${this.fromVersion}`
          )
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.getDocument(
            this.project_id,
            this.doc_id,
            this.fromVersion
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .get(
            `/project/${this.project_id}/doc/${this.doc_id}?fromVersion=${this.fromVersion}`
          )
          .reply(500)
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.getDocument(
            this.project_id,
            this.doc_id,
            this.fromVersion
          )
        ).to.be.rejected
      })
    })
  })

  describe('getProjectDocsIfMatch', function () {
    beforeEach(function () {
      this.project_state_hash = '1234567890abcdef'
      this.doc0 = {
        _id: this.doc_id,
        lines: this.lines,
        v: this.version,
      }
      this.docs = [this.doc0, this.doc0, this.doc0]
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(
            `/project/${this.project_id}/get_and_flush_if_old?state=${this.project_state_hash}`
          )
          .reply(200, this.docs)
      })

      it('should call the callback with the documents', async function () {
        const docs = await this.handler.promises.getProjectDocsIfMatch(
          this.project_id,
          this.project_state_hash
        )
        expect(docs).to.deep.equal(this.docs)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(
            `/project/${this.project_id}/get_and_flush_if_old?state=${this.project_state_hash}`
          )
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.getProjectDocsIfMatch(
            this.project_id,
            this.project_state_hash
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a conflict error code', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(
            `/project/${this.project_id}/get_and_flush_if_old?state=${this.project_state_hash}`
          )
          .reply(409)
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
        this.docUpdaterMock
          .post(`/project/${this.project_id}/clearState`)
          .reply(200)
      })

      it('should clear the project state from the document updater', async function () {
        await this.handler.promises.clearProjectState(this.project_id)
        expect(this.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/clearState`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(this.handler.promises.clearProjectState(this.project_id))
          .to.be.rejected
      })
    })

    describe('when the document updater returns an error code', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/clearState`)
          .reply(500)
      })

      it('should reject with an error', async function () {
        await expect(this.handler.promises.clearProjectState(this.project_id))
          .to.be.rejected
      })
    })
  })

  describe('acceptChanges', function () {
    beforeEach(function () {
      this.change_id = 'mock-change-id-1'
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(
            `/project/${this.project_id}/doc/${this.doc_id}/change/accept`,
            {
              change_ids: [this.change_id],
            }
          )
          .reply(200)
      })

      it('should accept the change in the document updater', async function () {
        await this.handler.promises.acceptChanges(
          this.project_id,
          this.doc_id,
          [this.change_id]
        )
        expect(this.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/doc/${this.doc_id}/change/accept`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.acceptChanges(this.project_id, this.doc_id, [
            this.change_id,
          ])
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/doc/${this.doc_id}/change/accept`)
          .reply(500)
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.acceptChanges(this.project_id, this.doc_id, [
            this.change_id,
          ])
        ).to.be.rejected
      })
    })
  })

  describe('deleteThread', function () {
    beforeEach(function () {
      this.thread_id = 'mock-thread-id-1'
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .delete(
            `/project/${this.project_id}/doc/${this.doc_id}/comment/${this.thread_id}`
          )
          .reply(200)
      })

      it('should delete the thread in the document updater', async function () {
        await this.handler.promises.deleteThread(
          this.project_id,
          this.doc_id,
          this.thread_id,
          this.user_id
        )
        expect(this.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .delete(
            `/project/${this.project_id}/doc/${this.doc_id}/comment/${this.thread_id}`
          )
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.deleteThread(
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.user_id
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .delete(
            `/project/${this.project_id}/doc/${this.doc_id}/comment/${this.thread_id}`
          )
          .reply(500)
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.deleteThread(
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.user_id
          )
        ).to.be.rejected
      })
    })
  })

  describe('resolveThread', function () {
    beforeEach(function () {
      this.thread_id = 'mock-thread-id-1'
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(
            `/project/${this.project_id}/doc/${this.doc_id}/comment/${this.thread_id}/resolve`
          )
          .reply(200)
      })

      it('should resolve the thread in the document updater', async function () {
        await this.handler.promises.resolveThread(
          this.project_id,
          this.doc_id,
          this.thread_id,
          this.user_id
        )
        expect(this.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(
            `/project/${this.project_id}/doc/${this.doc_id}/comment/${this.thread_id}/resolve`
          )
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.resolveThread(
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.user_id
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(
            `/project/${this.project_id}/doc/${this.doc_id}/comment/${this.thread_id}/resolve`
          )
          .reply(500)
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.resolveThread(
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.user_id
          )
        ).to.be.rejected
      })
    })
  })

  describe('reopenThread', function () {
    beforeEach(function () {
      this.thread_id = 'mock-thread-id-1'
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(
            `/project/${this.project_id}/doc/${this.doc_id}/comment/${this.thread_id}/reopen`
          )
          .reply(200)
      })

      it('should reopen the thread in the document updater', async function () {
        await this.handler.promises.reopenThread(
          this.project_id,
          this.doc_id,
          this.thread_id,
          this.user_id
        )
        expect(this.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(
            `/project/${this.project_id}/doc/${this.doc_id}/comment/${this.thread_id}/reopen`
          )
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.reopenThread(
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.user_id
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(
            `/project/${this.project_id}/doc/${this.doc_id}/comment/${this.thread_id}/reopen`
          )
          .reply(500)
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.reopenThread(
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.user_id
          )
        ).to.be.rejected
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

      it('returns early', async function () {
        await this.handler.promises.updateProjectStructure(
          this.project_id,
          this.projectHistoryId,
          this.user_id,
          {},
          this.source
        )
      })
    })

    describe('with project history enabled', function () {
      beforeEach(function () {
        this.settings.apis.project_history.sendProjectStructureOps = true
      })

      describe('when an entity has changed name', function () {
        it('should send the structure update to the document updater', async function () {
          const docIdA = new ObjectId()
          const docIdB = new ObjectId()
          const changes = {
            oldDocs: [
              { path: '/old_a', doc: { _id: docIdA } },
              { path: '/old_b', doc: { _id: docIdB } },
            ],
            // create new instances of the same ObjectIds so that == doesn't pass
            newDocs: [
              {
                path: '/old_a',
                doc: { _id: new ObjectId(docIdA.toString()) },
              },
              {
                path: '/new_b',
                doc: { _id: new ObjectId(docIdB.toString()) },
              },
            ],
            newProject: { version: this.version },
          }

          const updates = [
            {
              type: 'rename-doc',
              id: docIdB.toString(),
              pathname: '/old_b',
              newPathname: '/new_b',
            },
          ]

          this.docUpdaterMock
            .post(`/project/${this.project_id}`, {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            })
            .reply(204)
          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            changes,
            this.source
          )
          expect(this.docUpdaterMock.isDone()).to.be.true
        })
      })

      describe('when a doc has been added', function () {
        it('should send the structure update to the document updater', async function () {
          const docId = new ObjectId()
          const changes = {
            newDocs: [{ path: '/foo', docLines: 'a\nb', doc: { _id: docId } }],
            newProject: { version: this.version },
          }

          const updates = [
            {
              type: 'add-doc',
              id: docId.toString(),
              pathname: '/foo',
              docLines: 'a\nb',
              historyRangesSupport: false,
              hash: undefined,
              ranges: undefined,
              metadata: undefined,
              createdBlob: true,
            },
          ]

          this.docUpdaterMock
            .post(`/project/${this.project_id}`, {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            })
            .reply(204)
          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            changes,
            this.source
          )

          expect(this.docUpdaterMock.isDone()).to.be.true
        })
      })

      describe('when a file has been added', function () {
        it('should send the structure update to the document updater', async function () {
          const fileId = new ObjectId()
          const changes = {
            newFiles: [
              {
                path: '/bar',
                file: { _id: fileId, hash: '12345' },
              },
            ],
            newProject: { version: this.version },
          }

          const updates = [
            {
              type: 'add-file',
              id: fileId.toString(),
              pathname: '/bar',
              docLines: undefined,
              historyRangesSupport: false,
              hash: '12345',
              ranges: undefined,
              createdBlob: true,
              metadata: undefined,
            },
          ]

          this.docUpdaterMock
            .post(`/project/${this.project_id}`, {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            })
            .reply(204)

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            changes,
            this.source
          )

          expect(this.docUpdaterMock.isDone()).to.be.true
        })
      })

      describe('when an entity has been deleted', function () {
        it('should end the structure update to the document updater', async function () {
          const docId = new ObjectId()
          const changes = {
            oldDocs: [{ path: '/foo', docLines: 'a\nb', doc: { _id: docId } }],
            newProject: { version: this.version },
          }

          const updates = [
            {
              type: 'rename-doc',
              id: docId.toString(),
              pathname: '/foo',
              newPathname: '',
            },
          ]

          this.docUpdaterMock
            .post(`/project/${this.project_id}`, {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            })
            .reply(204)

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            changes,
            this.source
          )

          expect(this.docUpdaterMock.isDone()).to.be.true
        })
      })

      describe('when a file is converted to a doc', function () {
        it('should send the delete first', async function () {
          const docId = new ObjectId()
          const fileId = new ObjectId()
          const changes = {
            oldFiles: [
              {
                path: '/foo.doc',
                file: { _id: fileId },
              },
            ],
            newDocs: [
              {
                path: '/foo.doc',
                docLines: 'hello there',
                doc: { _id: docId },
              },
            ],
            newProject: { version: this.version },
          }

          const updates = [
            {
              type: 'rename-file',
              id: fileId.toString(),
              pathname: '/foo.doc',
              newPathname: '',
            },
            {
              type: 'add-doc',
              id: docId.toString(),
              pathname: '/foo.doc',
              docLines: 'hello there',
              historyRangesSupport: false,
              hash: undefined,
              ranges: undefined,
              metadata: undefined,
              createdBlob: true,
            },
          ]

          this.docUpdaterMock
            .post(`/project/${this.project_id}`, {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            })
            .reply(204)

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            changes,
            this.source
          )

          expect(this.docUpdaterMock.isDone()).to.be.true
        })
      })

      describe('when the project version is missing', function () {
        it('should call the callback with an error', async function () {
          const docId = new ObjectId()
          const changes = {
            oldDocs: [{ path: '/foo', docLines: 'a\nb', doc: { _id: docId } }],
          }
          await expect(
            this.handler.promises.updateProjectStructure(
              this.project_id,
              this.projectHistoryId,
              this.user_id,
              changes,
              this.source
            )
          ).to.be.rejectedWith('did not receive project version in changes')
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
              hash: undefined,
              ranges: this.ranges,
              metadata: undefined,
              createdBlob: true,
            },
          ]

          this.docUpdaterMock
            .post(`/project/${this.project_id}`, {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            })
            .reply(204)

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.changes,
            this.source
          )

          expect(this.docUpdaterMock.isDone()).to.be.true
        })

        it('should include flag when history ranges support is enabled', async function () {
          this.ProjectGetter.promises.getProjectWithoutLock
            .withArgs(this.project_id)
            .resolves({
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
              hash: undefined,
              ranges: this.ranges,
              metadata: undefined,
              createdBlob: true,
            },
          ]

          this.docUpdaterMock
            .post(`/project/${this.project_id}`, {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            })
            .reply(204)

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.changes,
            this.source
          )

          expect(this.docUpdaterMock.isDone()).to.be.true
        })
      })

      describe('with filestore disabled', function () {
        beforeEach(function () {
          this.fileId = new ObjectId()
          const updates = [
            {
              type: 'add-file',
              id: this.fileId.toString(),
              pathname: '/bar',
              docLines: undefined,
              historyRangesSupport: false,
              hash: '12345',
              ranges: undefined,
              createdBlob: true,
              metadata: undefined,
            },
          ]

          this.docUpdaterMock
            .post(`/project/${this.project_id}`, {
              updates,
              userId: this.user_id,
              version: this.version,
              projectHistoryId: this.projectHistoryId,
              source: this.source,
            })
            .reply(204)
        })

        it('should add files without URL and with createdBlob', async function () {
          this.changes = {
            newFiles: [
              {
                path: '/bar',
                file: { _id: this.fileId, hash: '12345' },
              },
            ],
            newProject: { version: this.version },
          }

          await this.handler.promises.updateProjectStructure(
            this.project_id,
            this.projectHistoryId,
            this.user_id,
            this.changes,
            this.source
          )

          expect(this.docUpdaterMock.isDone()).to.be.true
        })

        it('should flag files without hash', async function () {
          this.fileId = new ObjectId()
          this.changes = {
            newFiles: [
              {
                path: '/bar',
                file: { _id: this.fileId },
              },
            ],
            newProject: { version: this.version },
          }

          await expect(
            this.handler.promises.updateProjectStructure(
              this.project_id,
              this.projectHistoryId,
              this.user_id,
              this.changes,
              this.source
            )
          ).to.be.rejected
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
      const projectId = new ObjectId()
      const projectHistoryId = 99

      this.docUpdaterMock
        .post(`/project/${projectId}/history/resync`, {
          docs: [
            { doc: docId1.toString(), path: 'main.tex' },
            { doc: docId2.toString(), path: 'references.bib' },
          ],
          files: [],
          projectHistoryId,
        })
        .reply(200)

      await this.handler.promises.resyncProjectHistory(
        projectId,
        projectHistoryId,
        docs,
        files,
        {}
      )

      expect(this.docUpdaterMock.isDone()).to.be.true
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
      const projectId = new ObjectId()
      const projectHistoryId = 99

      this.docUpdaterMock
        .post(`/project/${projectId}/history/resync`, {
          docs: [],
          files: [
            {
              file: fileId1.toString(),
              _hash: '42',
              path: '1.png',
              createdBlob: true,
            },
            {
              file: fileId2.toString(),
              _hash: '1337',
              path: '1.bib',
              createdBlob: true,
              metadata: {
                importedAt: fileCreated2.toISOString(),
                provider: 'references-provider',
              },
            },
            {
              file: fileId3.toString(),
              _hash: '21',
              path: 'bar.txt',
              createdBlob: true,
              metadata: {
                importedAt: fileCreated3.toISOString(),
                provider: 'project_output_file',
                source_project_id: otherProjectId.toString(),
                source_output_file_path: 'foo/bar.txt',
                // build_id and clsiServerId are omitted
              },
            },
          ],
          projectHistoryId,
        })
        .reply(200)

      await this.handler.promises.resyncProjectHistory(
        projectId,
        projectHistoryId,
        docs,
        files,
        {}
      )

      expect(this.docUpdaterMock.isDone()).to.be.true
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
      const projectId = new ObjectId()
      const projectHistoryId = 99

      this.docUpdaterMock
        .post(`/project/${projectId}/history/resync`, {
          docs: [],
          files: [
            {
              file: fileId1.toString(),
              _hash: '42',
              path: '1.png',
              createdBlob: true,
            },
            {
              file: fileId2.toString(),
              _hash: '1337',
              path: '1.bib',
              createdBlob: true,
              metadata: {
                importedAt: fileCreated2.toISOString(),
                provider: 'references-provider',
              },
            },
            {
              file: fileId3.toString(),
              _hash: '21',
              path: 'bar.txt',
              createdBlob: true,
              metadata: {
                importedAt: fileCreated3.toISOString(),
                provider: 'project_output_file',
                source_project_id: otherProjectId,
                source_output_file_path: 'foo/bar.txt',
                // build_id and clsiServerId are omitted
              },
            },
          ],
          projectHistoryId,
        })
        .reply(200)
      await this.handler.promises.resyncProjectHistory(
        projectId,
        projectHistoryId,
        docs,
        files,
        {}
      )
      expect(this.docUpdaterMock.isDone()).to.be.true
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

  describe('appendToDocument', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.body = { rev: 1 }
        this.docUpdaterMock
          .post(`/project/${this.project_id}/doc/${this.doc_id}/append`, {
            lines: this.lines,
            source: this.source,
            user_id: this.user_id,
          })
          .reply(200)
      })

      it('should append to the document in the document updater', async function () {
        await this.handler.promises.appendToDocument(
          this.project_id,
          this.doc_id,
          this.user_id,
          this.lines,
          this.source
        )
        expect(this.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/doc/${this.doc_id}/append`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.appendToDocument(
            this.project_id,
            this.doc_id,
            this.user_id,
            this.lines,
            this.source
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.docUpdaterMock
          .post(`/project/${this.project_id}/doc/${this.doc_id}/append`)
          .reply(500)
      })

      it('should reject with an error', async function () {
        await expect(
          this.handler.promises.appendToDocument(
            this.project_id,
            this.doc_id,
            this.user_id,
            this.lines,
            this.source
          )
        ).to.be.rejected
      })
    })
  })
})
