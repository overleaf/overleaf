import { vi, expect } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'
import mongodb from 'mongodb-legacy'
import nock from 'nock'

const { ObjectId } = mongodb

const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler'
)

describe('DocumentUpdaterHandler', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = 'project-id-923'
    ctx.projectHistoryId = 'ol-project-id-1'
    ctx.doc_id = 'doc-id-394'
    ctx.lines = ['one', 'two', 'three']
    ctx.version = 42
    ctx.user_id = 'mock-user-id-123'
    ctx.project = { _id: ctx.project_id }

    ctx.projectEntityHandler = {}
    ctx.settings = {
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
    ctx.source = 'dropbox'
    ctx.docUpdaterMock = nock(ctx.settings.apis.documentupdater.url)

    ctx.ProjectGetter = {
      promises: {
        getProjectWithoutLock: sinon.stub(),
      },
    }
    ctx.ProjectGetter.promises.getProjectWithoutLock
      .withArgs(ctx.project_id)
      .resolves(ctx.project)

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityHandler',
      () => ({
        default: ctx.projectEntityHandler,
      })
    )

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project: (ctx.Project = {}),
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectLocator', () => ({
      default: {},
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        Timer: class {
          done() {}
        },
      },
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: {
        promises: {
          hooks: {
            fire: sinon.stub().resolves(),
          },
        },
      },
    }))

    ctx.handler = (await import(modulePath)).default
  })

  afterEach(function () {
    nock.cleanAll()
  })

  describe('flushProjectToMongo', function () {
    describe('successfully', function () {
      beforeEach(async function (ctx) {
        ctx.docUpdaterMock.post(`/project/${ctx.project_id}/flush`).reply(204)
        await ctx.handler.promises.flushProjectToMongo(ctx.project_id)
      })

      it('should flush the document from the document updater', function (ctx) {
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/flush`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(ctx.handler.promises.flushProjectToMongo(ctx.project_id))
          .to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock.post(`/project/${ctx.project_id}/flush`).reply(500)
      })

      it('should reject with an error', async function (ctx) {
        await expect(ctx.handler.promises.flushProjectToMongo(ctx.project_id))
          .to.be.rejected
      })
    })
  })

  describe('flushProjectToMongoAndDelete', function () {
    describe('successfully', function () {
      beforeEach(async function (ctx) {
        ctx.docUpdaterMock.delete(`/project/${ctx.project_id}`).reply(204)
        await ctx.handler.promises.flushProjectToMongoAndDelete(ctx.project_id)
      })

      it('should delete the project from the document updater', function (ctx) {
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .delete(`/project/${ctx.project_id}`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.flushProjectToMongoAndDelete(ctx.project_id)
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock.delete(`/project/${ctx.project_id}`).reply(500)
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.flushProjectToMongoAndDelete(ctx.project_id)
        ).to.be.rejected
      })
    })
  })

  describe('flushDocToMongo', function () {
    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/doc/${ctx.doc_id}/flush`)
          .reply(204)
      })

      it('should flush the document from the document updater', async function (ctx) {
        await ctx.handler.promises.flushDocToMongo(ctx.project_id, ctx.doc_id)
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/doc/${ctx.doc_id}/flush`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.flushDocToMongo(ctx.project_id, ctx.doc_id)
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/doc/${ctx.doc_id}/flush`)
          .reply(500)
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.flushDocToMongo(ctx.project_id, ctx.doc_id)
        ).to.be.rejected
      })
    })
  })

  describe('deleteDoc', function () {
    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .delete(`/project/${ctx.project_id}/doc/${ctx.doc_id}`)
          .reply(204)
      })

      it('should delete the document from the document updater', async function (ctx) {
        await ctx.handler.promises.deleteDoc(ctx.project_id, ctx.doc_id)
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .delete(`/project/${ctx.project_id}/doc/${ctx.doc_id}`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(ctx.handler.promises.deleteDoc(ctx.project_id, ctx.doc_id))
          .to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .delete(`/project/${ctx.project_id}/doc/${ctx.doc_id}`)
          .reply(500)
      })

      it('should reject with an error', async function (ctx) {
        await expect(ctx.handler.promises.deleteDoc(ctx.project_id, ctx.doc_id))
          .to.be.rejected
      })
    })

    describe("with 'ignoreFlushErrors' option", function () {
      it('when option is true, should send a `ignore_flush_errors=true` URL query to document-updater', async function (ctx) {
        ctx.docUpdaterMock
          .delete(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}?ignore_flush_errors=true`
          )
          .reply(204)
        await ctx.handler.promises.deleteDoc(ctx.project_id, ctx.doc_id, true)
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })

      it("when option is false, shouldn't send any URL query to document-updater", async function (ctx) {
        ctx.docUpdaterMock
          .delete(`/project/${ctx.project_id}/doc/${ctx.doc_id}`)
          .reply(204)
        await ctx.handler.promises.deleteDoc(ctx.project_id, ctx.doc_id, false)
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })
    })
  })

  describe('setDocument', function () {
    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/doc/${ctx.doc_id}`, {
            lines: ctx.lines,
            source: ctx.source,
            user_id: ctx.user_id,
          })
          .reply(204)
      })

      it('should set the document in the document updater', async function (ctx) {
        await ctx.handler.promises.setDocument(
          ctx.project_id,
          ctx.doc_id,
          ctx.user_id,
          ctx.lines,
          ctx.source
        )
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/doc/${ctx.doc_id}`, {
            lines: ctx.lines,
            source: ctx.source,
            user_id: ctx.user_id,
          })
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.setDocument(
            ctx.project_id,
            ctx.doc_id,
            ctx.user_id,
            ctx.lines,
            ctx.source
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/doc/${ctx.doc_id}`, {
            lines: ctx.lines,
            source: ctx.source,
            user_id: ctx.user_id,
          })
          .reply(500)
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.setDocument(
            ctx.project_id,
            ctx.doc_id,
            ctx.user_id,
            ctx.lines,
            ctx.source
          )
        ).to.be.rejected
      })
    })
  })

  describe('getComment', function () {
    beforeEach(function (ctx) {
      ctx.comment = { id: new ObjectId().toString() }
      ctx.docUpdaterMock
        .get(
          `/project/${ctx.project_id}/doc/${ctx.doc_id}/comment/${ctx.comment.id}`
        )
        .reply(200, ctx.comment)
    })

    it('should get the comment from the document updater', async function (ctx) {
      const body = await ctx.handler.promises.getComment(
        ctx.project_id,
        ctx.doc_id,
        ctx.comment.id
      )
      expect(body).to.deep.equal(ctx.comment)
    })
  })

  describe('getDocument', function () {
    beforeEach(function (ctx) {
      ctx.doc = {
        lines: ctx.lines,
        version: ctx.version,
        ops: ['mock-op-1', 'mock-op-2'],
        ranges: { mock: 'ranges' },
      }
      ctx.fromVersion = 2
    })

    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .get(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}?fromVersion=${ctx.fromVersion}`
          )
          .reply(200, ctx.doc)
      })

      it('should return the lines and version', async function (ctx) {
        const doc = await ctx.handler.promises.getDocument(
          ctx.project_id,
          ctx.doc_id,
          ctx.fromVersion
        )
        expect(doc).to.deep.equal(ctx.doc)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .get(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}?fromVersion=${ctx.fromVersion}`
          )
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.getDocument(
            ctx.project_id,
            ctx.doc_id,
            ctx.fromVersion
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .get(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}?fromVersion=${ctx.fromVersion}`
          )
          .reply(500)
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.getDocument(
            ctx.project_id,
            ctx.doc_id,
            ctx.fromVersion
          )
        ).to.be.rejected
      })
    })
  })

  describe('getProjectDocsIfMatch', function () {
    beforeEach(function (ctx) {
      ctx.project_state_hash = '1234567890abcdef'
      ctx.doc0 = {
        _id: ctx.doc_id,
        lines: ctx.lines,
        v: ctx.version,
      }
      ctx.docs = [ctx.doc0, ctx.doc0, ctx.doc0]
    })

    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(
            `/project/${ctx.project_id}/get_and_flush_if_old?state=${ctx.project_state_hash}`
          )
          .reply(200, ctx.docs)
      })

      it('should call the callback with the documents', async function (ctx) {
        const docs = await ctx.handler.promises.getProjectDocsIfMatch(
          ctx.project_id,
          ctx.project_state_hash
        )
        expect(docs).to.deep.equal(ctx.docs)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(
            `/project/${ctx.project_id}/get_and_flush_if_old?state=${ctx.project_state_hash}`
          )
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.getProjectDocsIfMatch(
            ctx.project_id,
            ctx.project_state_hash
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a conflict error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(
            `/project/${ctx.project_id}/get_and_flush_if_old?state=${ctx.project_state_hash}`
          )
          .reply(409)
      })

      it('should return no documents', async function (ctx) {
        const response = await ctx.handler.promises.getProjectDocsIfMatch(
          ctx.project_id,
          ctx.project_state_hash
        )
        expect(response).to.be.undefined
      })
    })
  })

  describe('clearProjectState', function () {
    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/clearState`)
          .reply(200)
      })

      it('should clear the project state from the document updater', async function (ctx) {
        await ctx.handler.promises.clearProjectState(ctx.project_id)
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/clearState`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(ctx.handler.promises.clearProjectState(ctx.project_id)).to
          .be.rejected
      })
    })

    describe('when the document updater returns an error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/clearState`)
          .reply(500)
      })

      it('should reject with an error', async function (ctx) {
        await expect(ctx.handler.promises.clearProjectState(ctx.project_id)).to
          .be.rejected
      })
    })
  })

  describe('acceptChanges', function () {
    beforeEach(function (ctx) {
      ctx.change_id = 'mock-change-id-1'
    })

    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/doc/${ctx.doc_id}/change/accept`, {
            change_ids: [ctx.change_id],
          })
          .reply(200)
      })

      it('should accept the change in the document updater', async function (ctx) {
        await ctx.handler.promises.acceptChanges(ctx.project_id, ctx.doc_id, [
          ctx.change_id,
        ])
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/doc/${ctx.doc_id}/change/accept`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.acceptChanges(ctx.project_id, ctx.doc_id, [
            ctx.change_id,
          ])
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/doc/${ctx.doc_id}/change/accept`)
          .reply(500)
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.acceptChanges(ctx.project_id, ctx.doc_id, [
            ctx.change_id,
          ])
        ).to.be.rejected
      })
    })
  })

  describe('deleteThread', function () {
    beforeEach(function (ctx) {
      ctx.thread_id = 'mock-thread-id-1'
    })

    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .delete(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}/comment/${ctx.thread_id}`
          )
          .reply(200)
      })

      it('should delete the thread in the document updater', async function (ctx) {
        await ctx.handler.promises.deleteThread(
          ctx.project_id,
          ctx.doc_id,
          ctx.thread_id,
          ctx.user_id
        )
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .delete(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}/comment/${ctx.thread_id}`
          )
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.deleteThread(
            ctx.project_id,
            ctx.doc_id,
            ctx.thread_id,
            ctx.user_id
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .delete(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}/comment/${ctx.thread_id}`
          )
          .reply(500)
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.deleteThread(
            ctx.project_id,
            ctx.doc_id,
            ctx.thread_id,
            ctx.user_id
          )
        ).to.be.rejected
      })
    })
  })

  describe('resolveThread', function () {
    beforeEach(function (ctx) {
      ctx.thread_id = 'mock-thread-id-1'
    })

    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}/comment/${ctx.thread_id}/resolve`
          )
          .reply(200)
      })

      it('should resolve the thread in the document updater', async function (ctx) {
        await ctx.handler.promises.resolveThread(
          ctx.project_id,
          ctx.doc_id,
          ctx.thread_id,
          ctx.user_id
        )
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}/comment/${ctx.thread_id}/resolve`
          )
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.resolveThread(
            ctx.project_id,
            ctx.doc_id,
            ctx.thread_id,
            ctx.user_id
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}/comment/${ctx.thread_id}/resolve`
          )
          .reply(500)
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.resolveThread(
            ctx.project_id,
            ctx.doc_id,
            ctx.thread_id,
            ctx.user_id
          )
        ).to.be.rejected
      })
    })
  })

  describe('reopenThread', function () {
    beforeEach(function (ctx) {
      ctx.thread_id = 'mock-thread-id-1'
    })

    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}/comment/${ctx.thread_id}/reopen`
          )
          .reply(200)
      })

      it('should reopen the thread in the document updater', async function (ctx) {
        await ctx.handler.promises.reopenThread(
          ctx.project_id,
          ctx.doc_id,
          ctx.thread_id,
          ctx.user_id
        )
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}/comment/${ctx.thread_id}/reopen`
          )
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.reopenThread(
            ctx.project_id,
            ctx.doc_id,
            ctx.thread_id,
            ctx.user_id
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(
            `/project/${ctx.project_id}/doc/${ctx.doc_id}/comment/${ctx.thread_id}/reopen`
          )
          .reply(500)
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.reopenThread(
            ctx.project_id,
            ctx.doc_id,
            ctx.thread_id,
            ctx.user_id
          )
        ).to.be.rejected
      })
    })
  })

  describe('updateProjectStructure ', function () {
    beforeEach(function (ctx) {
      ctx.user_id = 1234
      ctx.version = 999
    })

    describe('with project history disabled', function () {
      beforeEach(function (ctx) {
        ctx.settings.apis.project_history.sendProjectStructureOps = false
      })

      it('returns early', async function (ctx) {
        await ctx.handler.promises.updateProjectStructure(
          ctx.project_id,
          ctx.projectHistoryId,
          ctx.user_id,
          {},
          ctx.source
        )
      })
    })

    describe('with project history enabled', function () {
      beforeEach(function (ctx) {
        ctx.settings.apis.project_history.sendProjectStructureOps = true
      })

      describe('when an entity has changed name', function () {
        it('should send the structure update to the document updater', async function (ctx) {
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
            newProject: { version: ctx.version },
          }

          const updates = [
            {
              type: 'rename-doc',
              id: docIdB.toString(),
              pathname: '/old_b',
              newPathname: '/new_b',
            },
          ]

          ctx.docUpdaterMock
            .post(`/project/${ctx.project_id}`, {
              updates,
              userId: ctx.user_id,
              version: ctx.version,
              projectHistoryId: ctx.projectHistoryId,
              source: ctx.source,
            })
            .reply(204)
          await ctx.handler.promises.updateProjectStructure(
            ctx.project_id,
            ctx.projectHistoryId,
            ctx.user_id,
            changes,
            ctx.source
          )
          expect(ctx.docUpdaterMock.isDone()).to.be.true
        })
      })

      describe('when a doc has been added', function () {
        it('should send the structure update to the document updater', async function (ctx) {
          const docId = new ObjectId()
          const changes = {
            newDocs: [{ path: '/foo', docLines: 'a\nb', doc: { _id: docId } }],
            newProject: { version: ctx.version },
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

          ctx.docUpdaterMock
            .post(`/project/${ctx.project_id}`, {
              updates,
              userId: ctx.user_id,
              version: ctx.version,
              projectHistoryId: ctx.projectHistoryId,
              source: ctx.source,
            })
            .reply(204)
          await ctx.handler.promises.updateProjectStructure(
            ctx.project_id,
            ctx.projectHistoryId,
            ctx.user_id,
            changes,
            ctx.source
          )

          expect(ctx.docUpdaterMock.isDone()).to.be.true
        })
      })

      describe('when a file has been added', function () {
        it('should send the structure update to the document updater', async function (ctx) {
          const fileId = new ObjectId()
          const changes = {
            newFiles: [
              {
                path: '/bar',
                file: { _id: fileId, hash: '12345' },
              },
            ],
            newProject: { version: ctx.version },
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

          ctx.docUpdaterMock
            .post(`/project/${ctx.project_id}`, {
              updates,
              userId: ctx.user_id,
              version: ctx.version,
              projectHistoryId: ctx.projectHistoryId,
              source: ctx.source,
            })
            .reply(204)

          await ctx.handler.promises.updateProjectStructure(
            ctx.project_id,
            ctx.projectHistoryId,
            ctx.user_id,
            changes,
            ctx.source
          )

          expect(ctx.docUpdaterMock.isDone()).to.be.true
        })
      })

      describe('when an entity has been deleted', function () {
        it('should end the structure update to the document updater', async function (ctx) {
          const docId = new ObjectId()
          const changes = {
            oldDocs: [{ path: '/foo', docLines: 'a\nb', doc: { _id: docId } }],
            newProject: { version: ctx.version },
          }

          const updates = [
            {
              type: 'rename-doc',
              id: docId.toString(),
              pathname: '/foo',
              newPathname: '',
            },
          ]

          ctx.docUpdaterMock
            .post(`/project/${ctx.project_id}`, {
              updates,
              userId: ctx.user_id,
              version: ctx.version,
              projectHistoryId: ctx.projectHistoryId,
              source: ctx.source,
            })
            .reply(204)

          await ctx.handler.promises.updateProjectStructure(
            ctx.project_id,
            ctx.projectHistoryId,
            ctx.user_id,
            changes,
            ctx.source
          )

          expect(ctx.docUpdaterMock.isDone()).to.be.true
        })
      })

      describe('when a file is converted to a doc', function () {
        it('should send the delete first', async function (ctx) {
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
            newProject: { version: ctx.version },
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

          ctx.docUpdaterMock
            .post(`/project/${ctx.project_id}`, {
              updates,
              userId: ctx.user_id,
              version: ctx.version,
              projectHistoryId: ctx.projectHistoryId,
              source: ctx.source,
            })
            .reply(204)

          await ctx.handler.promises.updateProjectStructure(
            ctx.project_id,
            ctx.projectHistoryId,
            ctx.user_id,
            changes,
            ctx.source
          )

          expect(ctx.docUpdaterMock.isDone()).to.be.true
        })
      })

      describe('when the project version is missing', function () {
        it('should call the callback with an error', async function (ctx) {
          const docId = new ObjectId()
          const changes = {
            oldDocs: [{ path: '/foo', docLines: 'a\nb', doc: { _id: docId } }],
          }
          await expect(
            ctx.handler.promises.updateProjectStructure(
              ctx.project_id,
              ctx.projectHistoryId,
              ctx.user_id,
              changes,
              ctx.source
            )
          ).to.be.rejectedWith('did not receive project version in changes')
        })
      })

      describe('when ranges are present', function () {
        beforeEach(function (ctx) {
          ctx.docId = new ObjectId()
          ctx.ranges = {
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
          ctx.changes = {
            newDocs: [
              {
                path: '/foo',
                docLines: 'foo\nbar',
                doc: { _id: ctx.docId },
                ranges: ctx.ranges,
              },
            ],
            newProject: { version: ctx.version },
          }
        })

        it('should forward ranges', async function (ctx) {
          const updates = [
            {
              type: 'add-doc',
              id: ctx.docId.toString(),
              pathname: '/foo',
              docLines: 'foo\nbar',
              historyRangesSupport: false,
              hash: undefined,
              ranges: ctx.ranges,
              metadata: undefined,
              createdBlob: true,
            },
          ]

          ctx.docUpdaterMock
            .post(`/project/${ctx.project_id}`, {
              updates,
              userId: ctx.user_id,
              version: ctx.version,
              projectHistoryId: ctx.projectHistoryId,
              source: ctx.source,
            })
            .reply(204)

          await ctx.handler.promises.updateProjectStructure(
            ctx.project_id,
            ctx.projectHistoryId,
            ctx.user_id,
            ctx.changes,
            ctx.source
          )

          expect(ctx.docUpdaterMock.isDone()).to.be.true
        })

        it('should include flag when history ranges support is enabled', async function (ctx) {
          ctx.ProjectGetter.promises.getProjectWithoutLock
            .withArgs(ctx.project_id)
            .resolves({
              _id: ctx.project_id,
              overleaf: { history: { rangesSupportEnabled: true } },
            })

          const updates = [
            {
              type: 'add-doc',
              id: ctx.docId.toString(),
              pathname: '/foo',
              docLines: 'foo\nbar',
              historyRangesSupport: true,
              hash: undefined,
              ranges: ctx.ranges,
              metadata: undefined,
              createdBlob: true,
            },
          ]

          ctx.docUpdaterMock
            .post(`/project/${ctx.project_id}`, {
              updates,
              userId: ctx.user_id,
              version: ctx.version,
              projectHistoryId: ctx.projectHistoryId,
              source: ctx.source,
            })
            .reply(204)

          await ctx.handler.promises.updateProjectStructure(
            ctx.project_id,
            ctx.projectHistoryId,
            ctx.user_id,
            ctx.changes,
            ctx.source
          )

          expect(ctx.docUpdaterMock.isDone()).to.be.true
        })
      })

      describe('with filestore disabled', function () {
        beforeEach(function (ctx) {
          ctx.fileId = new ObjectId()
          const updates = [
            {
              type: 'add-file',
              id: ctx.fileId.toString(),
              pathname: '/bar',
              docLines: undefined,
              historyRangesSupport: false,
              hash: '12345',
              ranges: undefined,
              createdBlob: true,
              metadata: undefined,
            },
          ]

          ctx.docUpdaterMock
            .post(`/project/${ctx.project_id}`, {
              updates,
              userId: ctx.user_id,
              version: ctx.version,
              projectHistoryId: ctx.projectHistoryId,
              source: ctx.source,
            })
            .reply(204)
        })

        it('should add files without URL and with createdBlob', async function (ctx) {
          ctx.changes = {
            newFiles: [
              {
                path: '/bar',
                file: { _id: ctx.fileId, hash: '12345' },
              },
            ],
            newProject: { version: ctx.version },
          }

          await ctx.handler.promises.updateProjectStructure(
            ctx.project_id,
            ctx.projectHistoryId,
            ctx.user_id,
            ctx.changes,
            ctx.source
          )

          expect(ctx.docUpdaterMock.isDone()).to.be.true
        })

        it('should flag files without hash', async function (ctx) {
          ctx.fileId = new ObjectId()
          ctx.changes = {
            newFiles: [
              {
                path: '/bar',
                file: { _id: ctx.fileId },
              },
            ],
            newProject: { version: ctx.version },
          }

          await expect(
            ctx.handler.promises.updateProjectStructure(
              ctx.project_id,
              ctx.projectHistoryId,
              ctx.user_id,
              ctx.changes,
              ctx.source
            )
          ).to.be.rejected
        })
      })
    })
  })

  describe('resyncProjectHistory', function () {
    it('should add docs', async function (ctx) {
      const docId1 = new ObjectId()
      const docId2 = new ObjectId()
      const docs = [
        { doc: { _id: docId1 }, path: 'main.tex' },
        { doc: { _id: docId2 }, path: 'references.bib' },
      ]
      const files = []
      const projectId = new ObjectId()
      const projectHistoryId = 99

      ctx.docUpdaterMock
        .post(`/project/${projectId}/history/resync`, {
          docs: [
            { doc: docId1.toString(), path: 'main.tex' },
            { doc: docId2.toString(), path: 'references.bib' },
          ],
          files: [],
          projectHistoryId,
        })
        .reply(200)

      await ctx.handler.promises.resyncProjectHistory(
        projectId,
        projectHistoryId,
        docs,
        files,
        {}
      )

      expect(ctx.docUpdaterMock.isDone()).to.be.true
    })

    it('should add files', async function (ctx) {
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

      ctx.docUpdaterMock
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

      await ctx.handler.promises.resyncProjectHistory(
        projectId,
        projectHistoryId,
        docs,
        files,
        {}
      )

      expect(ctx.docUpdaterMock.isDone()).to.be.true
    })

    it('should add files without URL', async function (ctx) {
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

      ctx.docUpdaterMock
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
      await ctx.handler.promises.resyncProjectHistory(
        projectId,
        projectHistoryId,
        docs,
        files,
        {}
      )
      expect(ctx.docUpdaterMock.isDone()).to.be.true
    })

    it('should flag files with missing hashes', async function (ctx) {
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
        ctx.handler.promises.resyncProjectHistory(
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
      beforeEach(function (ctx) {
        ctx.body = { rev: 1 }
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/doc/${ctx.doc_id}/append`, {
            lines: ctx.lines,
            source: ctx.source,
            user_id: ctx.user_id,
          })
          .reply(200)
      })

      it('should append to the document in the document updater', async function (ctx) {
        await ctx.handler.promises.appendToDocument(
          ctx.project_id,
          ctx.doc_id,
          ctx.user_id,
          ctx.lines,
          ctx.source
        )
        expect(ctx.docUpdaterMock.isDone()).to.be.true
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/doc/${ctx.doc_id}/append`)
          .replyWithError('boom')
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.appendToDocument(
            ctx.project_id,
            ctx.doc_id,
            ctx.user_id,
            ctx.lines,
            ctx.source
          )
        ).to.be.rejected
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.docUpdaterMock
          .post(`/project/${ctx.project_id}/doc/${ctx.doc_id}/append`)
          .reply(500)
      })

      it('should reject with an error', async function (ctx) {
        await expect(
          ctx.handler.promises.appendToDocument(
            ctx.project_id,
            ctx.doc_id,
            ctx.user_id,
            ctx.lines,
            ctx.source
          )
        ).to.be.rejected
      })
    })
  })
})
