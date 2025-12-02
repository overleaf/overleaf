import sinon from 'sinon'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ObjectId } from 'mongodb-legacy'
import Errors from '../../../app/js/Errors.js'
import path from 'node:path'

const modulePath = path.join(import.meta.dirname, '../../../app/js/DocManager')

describe('DocManager', () => {
  beforeEach(async ctx => {
    ctx.doc_id = new ObjectId().toString()
    ctx.project_id = new ObjectId().toString()
    ctx.another_project_id = new ObjectId().toString()
    ctx.stubbedError = new Error('blew up')
    ctx.version = 42

    ctx.MongoManager = {
      findDoc: sinon.stub(),
      getProjectsDocs: sinon.stub(),
      patchDoc: sinon.stub().resolves(),
      upsertIntoDocCollection: sinon.stub().resolves(),
    }
    ctx.DocArchiveManager = {
      unarchiveDoc: sinon.stub(),
      unArchiveAllDocs: sinon.stub(),
      archiveDoc: sinon.stub().resolves(),
    }
    ctx.RangeManager = {
      jsonRangesToMongo(r) {
        return r
      },
      shouldUpdateRanges: sinon.stub().returns(false),
      fixCommentIds: sinon.stub(),
    }
    ctx.settings = { docstore: {} }

    vi.doMock('../../../app/js/MongoManager', () => ({
      default: ctx.MongoManager,
    }))

    vi.doMock('../../../app/js/DocArchiveManager', () => ({
      default: ctx.DocArchiveManager,
    }))

    vi.doMock('../../../app/js/RangeManager', () => ({
      default: ctx.RangeManager,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('../../../app/js/Errors', () => ({
      default: Errors,
    }))

    ctx.DocManager = (await import(modulePath)).default
  })

  describe('getFullDoc', () => {
    beforeEach(ctx => {
      ctx.DocManager._getDoc = sinon.stub()
      ctx.doc = {
        _id: ctx.doc_id,
        lines: ['2134'],
      }
    })

    it('should call get doc with a quick filter', async ctx => {
      ctx.DocManager._getDoc.resolves(ctx.doc)
      const doc = await ctx.DocManager.getFullDoc(ctx.project_id, ctx.doc_id)
      doc.should.equal(ctx.doc)
      ctx.DocManager._getDoc
        .calledWith(ctx.project_id, ctx.doc_id, {
          lines: true,
          rev: true,
          deleted: true,
          version: true,
          ranges: true,
          inS3: true,
        })
        .should.equal(true)
    })

    it('should return error when get doc errors', async ctx => {
      ctx.DocManager._getDoc.rejects(ctx.stubbedError)
      await expect(
        ctx.DocManager.getFullDoc(ctx.project_id, ctx.doc_id)
      ).to.be.rejectedWith(ctx.stubbedError)
    })
  })

  describe('getRawDoc', () => {
    beforeEach(ctx => {
      ctx.DocManager._getDoc = sinon.stub()
      ctx.doc = { lines: ['2134'] }
    })

    it('should call get doc with a quick filter', async ctx => {
      ctx.DocManager._getDoc.resolves(ctx.doc)
      const content = await ctx.DocManager.getDocLines(
        ctx.project_id,
        ctx.doc_id
      )
      content.should.equal(ctx.doc.lines.join('\n'))
      ctx.DocManager._getDoc
        .calledWith(ctx.project_id, ctx.doc_id, {
          lines: true,
          inS3: true,
        })
        .should.equal(true)
    })

    it('should return error when get doc errors', async ctx => {
      ctx.DocManager._getDoc.rejects(ctx.stubbedError)
      await expect(
        ctx.DocManager.getDocLines(ctx.project_id, ctx.doc_id)
      ).to.be.rejectedWith(ctx.stubbedError)
    })

    it('should return error when get doc does not exist', async ctx => {
      ctx.DocManager._getDoc.resolves(null)
      await expect(
        ctx.DocManager.getDocLines(ctx.project_id, ctx.doc_id)
      ).to.be.rejectedWith(Errors.NotFoundError)
    })

    it('should return error when get doc has no lines', async ctx => {
      ctx.DocManager._getDoc.resolves({})
      await expect(
        ctx.DocManager.getDocLines(ctx.project_id, ctx.doc_id)
      ).to.be.rejectedWith(Errors.DocWithoutLinesError)
    })
  })

  describe('_getDoc', () => {
    it('should return error when get doc does not exist', async ctx => {
      ctx.MongoManager.findDoc.resolves(null)
      await expect(
        ctx.DocManager._getDoc(ctx.project_id, ctx.doc_id, { inS3: true })
      ).to.be.rejectedWith(Errors.NotFoundError)
    })

    it('should fix comment ids', async ctx => {
      ctx.MongoManager.findDoc.resolves({
        _id: ctx.doc_id,
        ranges: {},
      })
      await ctx.DocManager._getDoc(ctx.project_id, ctx.doc_id, {
        inS3: true,
        ranges: true,
      })
      expect(ctx.RangeManager.fixCommentIds).to.have.been.called
    })
  })

  describe('getDoc', () => {
    beforeEach(ctx => {
      ctx.project = { name: 'mock-project' }
      ctx.doc = {
        _id: ctx.doc_id,
        project_id: ctx.project_id,
        lines: ['mock-lines'],
        version: ctx.version,
      }
    })

    describe('when using a filter', () => {
      beforeEach(ctx => {
        ctx.MongoManager.findDoc.resolves(ctx.doc)
      })

      it('should error if inS3 is not set to true', async ctx => {
        await expect(
          ctx.DocManager._getDoc(ctx.project_id, ctx.doc_id, {
            inS3: false,
          })
        ).to.be.rejected
      })

      it('should always get inS3 even when no filter is passed', async ctx => {
        await expect(ctx.DocManager._getDoc(ctx.project_id, ctx.doc_id)).to.be
          .rejected
        ctx.MongoManager.findDoc.called.should.equal(false)
      })

      it('should not error if inS3 is set to true', async ctx => {
        await ctx.DocManager._getDoc(ctx.project_id, ctx.doc_id, {
          inS3: true,
        })
      })
    })

    describe('when the doc is in the doc collection', () => {
      beforeEach(async ctx => {
        ctx.MongoManager.findDoc.resolves(ctx.doc)
        ctx.result = await ctx.DocManager._getDoc(ctx.project_id, ctx.doc_id, {
          version: true,
          inS3: true,
        })
      })

      it('should get the doc from the doc collection', ctx => {
        ctx.MongoManager.findDoc
          .calledWith(ctx.project_id, ctx.doc_id)
          .should.equal(true)
      })

      it('should return the doc with the version', ctx => {
        ctx.result.lines.should.equal(ctx.doc.lines)
        ctx.result.version.should.equal(ctx.version)
      })
    })

    describe('when MongoManager.findDoc errors', () => {
      it('should return the error', async ctx => {
        ctx.MongoManager.findDoc.rejects(ctx.stubbedError)
        await expect(
          ctx.DocManager._getDoc(ctx.project_id, ctx.doc_id, {
            version: true,
            inS3: true,
          })
        ).to.be.rejectedWith(ctx.stubbedError)
      })
    })

    describe('when the doc is archived', () => {
      beforeEach(async ctx => {
        ctx.doc = {
          _id: ctx.doc_id,
          project_id: ctx.project_id,
          version: 2,
          inS3: true,
        }
        ctx.unarchivedDoc = {
          _id: ctx.doc_id,
          project_id: ctx.project_id,
          lines: ['mock-lines'],
          version: 2,
          inS3: false,
        }
        ctx.MongoManager.findDoc.resolves(ctx.doc)
        ctx.DocArchiveManager.unarchiveDoc.callsFake(
          async (projectId, docId) => {
            ctx.MongoManager.findDoc.resolves({
              ...ctx.unarchivedDoc,
            })
          }
        )
        ctx.result = await ctx.DocManager._getDoc(ctx.project_id, ctx.doc_id, {
          version: true,
          inS3: true,
        })
      })

      it('should call the DocArchive to unarchive the doc', ctx => {
        ctx.DocArchiveManager.unarchiveDoc
          .calledWith(ctx.project_id, ctx.doc_id)
          .should.equal(true)
      })

      it('should look up the doc twice', ctx => {
        ctx.MongoManager.findDoc.calledTwice.should.equal(true)
      })

      it('should return the doc', ctx => {
        expect(ctx.result).to.deep.equal({
          ...ctx.unarchivedDoc,
        })
      })
    })

    describe('when the doc does not exist in the docs collection', () => {
      it('should return a NotFoundError', async ctx => {
        ctx.MongoManager.findDoc.resolves(null)
        await expect(
          ctx.DocManager._getDoc(ctx.project_id, ctx.doc_id, {
            version: true,
            inS3: true,
          })
        ).to.be.rejectedWith(
          `No such doc: ${ctx.doc_id} in project ${ctx.project_id}`
        )
      })
    })
  })

  describe('getAllNonDeletedDocs', () => {
    describe('when the project exists', () => {
      beforeEach(async ctx => {
        ctx.docs = [
          {
            _id: ctx.doc_id,
            project_id: ctx.project_id,
            lines: ['mock-lines'],
          },
        ]
        ctx.MongoManager.getProjectsDocs.resolves(ctx.docs)
        ctx.DocArchiveManager.unArchiveAllDocs.resolves(ctx.docs)
        ctx.filter = { lines: true, ranges: true }
        ctx.result = await ctx.DocManager.getAllNonDeletedDocs(
          ctx.project_id,
          ctx.filter
        )
      })

      it('should get the project from the database', ctx => {
        ctx.MongoManager.getProjectsDocs.should.have.been.calledWith(
          ctx.project_id,
          { include_deleted: false },
          ctx.filter
        )
      })

      it('should fix comment ids', async ctx => {
        expect(ctx.RangeManager.fixCommentIds).to.have.been.called
      })

      it('should return the docs', ctx => {
        expect(ctx.result).to.deep.equal(ctx.docs)
      })
    })

    describe('when there are no docs for the project', () => {
      it('should return a NotFoundError', async ctx => {
        ctx.MongoManager.getProjectsDocs.resolves(null)
        ctx.DocArchiveManager.unArchiveAllDocs.resolves(null)
        await expect(
          ctx.DocManager.getAllNonDeletedDocs(ctx.project_id, ctx.filter)
        ).to.be.rejectedWith(`No docs for project ${ctx.project_id}`)
      })
    })
  })

  describe('patchDoc', () => {
    describe('when the doc exists', () => {
      beforeEach(ctx => {
        ctx.lines = ['mock', 'doc', 'lines']
        ctx.rev = 77
        ctx.MongoManager.findDoc.resolves({
          _id: new ObjectId(ctx.doc_id),
        })
        ctx.meta = {}
      })

      describe('standard path', () => {
        beforeEach(async ctx => {
          await ctx.DocManager.patchDoc(ctx.project_id, ctx.doc_id, ctx.meta)
        })

        it('should get the doc', ctx => {
          expect(ctx.MongoManager.findDoc).to.have.been.calledWith(
            ctx.project_id,
            ctx.doc_id
          )
        })

        it('should persist the meta', ctx => {
          expect(ctx.MongoManager.patchDoc).to.have.been.calledWith(
            ctx.project_id,
            ctx.doc_id,
            ctx.meta
          )
        })
      })

      describe('background flush disabled and deleting a doc', () => {
        beforeEach(async ctx => {
          ctx.settings.docstore.archiveOnSoftDelete = false
          ctx.meta.deleted = true

          await ctx.DocManager.patchDoc(ctx.project_id, ctx.doc_id, ctx.meta)
        })

        it('should not flush the doc out of mongo', ctx => {
          expect(ctx.DocArchiveManager.archiveDoc).to.not.have.been.called
        })
      })

      describe('background flush enabled and not deleting a doc', () => {
        beforeEach(async ctx => {
          ctx.settings.docstore.archiveOnSoftDelete = false
          ctx.meta.deleted = false
          await ctx.DocManager.patchDoc(ctx.project_id, ctx.doc_id, ctx.meta)
        })

        it('should not flush the doc out of mongo', ctx => {
          expect(ctx.DocArchiveManager.archiveDoc).to.not.have.been.called
        })
      })

      describe('background flush enabled and deleting a doc', () => {
        beforeEach(ctx => {
          ctx.settings.docstore.archiveOnSoftDelete = true
          ctx.meta.deleted = true
        })

        describe('when the background flush succeeds', () => {
          beforeEach(async ctx => {
            await ctx.DocManager.patchDoc(ctx.project_id, ctx.doc_id, ctx.meta)
          })

          it('should not log a warning', ctx => {
            expect(ctx.logger.warn).to.not.have.been.called
          })

          it('should flush the doc out of mongo', ctx => {
            expect(ctx.DocArchiveManager.archiveDoc).to.have.been.calledWith(
              ctx.project_id,
              ctx.doc_id
            )
          })
        })

        describe('when the background flush fails', () => {
          beforeEach(async ctx => {
            ctx.err = new Error('foo')
            ctx.DocArchiveManager.archiveDoc.rejects(ctx.err)
            await ctx.DocManager.patchDoc(ctx.project_id, ctx.doc_id, ctx.meta)
          })

          it('should log a warning', ctx => {
            expect(ctx.logger.warn).to.have.been.calledWith(
              sinon.match({
                projectId: ctx.project_id,
                docId: ctx.doc_id,
                err: ctx.err,
              }),
              'archiving a single doc in the background failed'
            )
          })
        })
      })
    })

    describe('when the doc does not exist', () => {
      it('should return a NotFoundError', async ctx => {
        ctx.MongoManager.findDoc.resolves(null)
        await expect(
          ctx.DocManager.patchDoc(ctx.project_id, ctx.doc_id, {})
        ).to.be.rejectedWith(
          `No such project/doc to delete: ${ctx.project_id}/${ctx.doc_id}`
        )
      })
    })
  })

  describe('updateDoc', () => {
    beforeEach(ctx => {
      ctx.oldDocLines = ['old', 'doc', 'lines']
      ctx.newDocLines = ['new', 'doc', 'lines']
      ctx.originalRanges = {
        changes: [
          {
            id: new ObjectId().toString(),
            op: { i: 'foo', p: 3 },
            meta: {
              user_id: new ObjectId().toString(),
              ts: new Date().toString(),
            },
          },
        ],
      }
      ctx.newRanges = {
        changes: [
          {
            id: new ObjectId().toString(),
            op: { i: 'bar', p: 6 },
            meta: {
              user_id: new ObjectId().toString(),
              ts: new Date().toString(),
            },
          },
        ],
      }
      ctx.version = 42
      ctx.doc = {
        _id: ctx.doc_id,
        project_id: ctx.project_id,
        lines: ctx.oldDocLines,
        rev: (ctx.rev = 5),
        version: ctx.version,
        ranges: ctx.originalRanges,
      }

      ctx.DocManager._getDoc = sinon.stub()
    })

    describe('when only the doc lines have changed', () => {
      beforeEach(async ctx => {
        ctx.DocManager._getDoc = sinon.stub().resolves(ctx.doc)
        ctx.result = await ctx.DocManager.updateDoc(
          ctx.project_id,
          ctx.doc_id,
          ctx.newDocLines,
          ctx.version,
          ctx.originalRanges
        )
      })

      it('should get the existing doc', ctx => {
        ctx.DocManager._getDoc
          .calledWith(ctx.project_id, ctx.doc_id, {
            version: true,
            rev: true,
            lines: true,
            ranges: true,
            inS3: true,
          })
          .should.equal(true)
      })

      it('should upsert the document to the doc collection', ctx => {
        ctx.MongoManager.upsertIntoDocCollection
          .calledWith(ctx.project_id, ctx.doc_id, ctx.rev, {
            lines: ctx.newDocLines,
          })
          .should.equal(true)
      })

      it('should return the new rev', ctx => {
        expect(ctx.result).to.deep.equal({ modified: true, rev: ctx.rev + 1 })
      })
    })

    describe('when the doc ranges have changed', () => {
      beforeEach(async ctx => {
        ctx.DocManager._getDoc = sinon.stub().resolves(ctx.doc)
        ctx.RangeManager.shouldUpdateRanges.returns(true)
        ctx.result = await ctx.DocManager.updateDoc(
          ctx.project_id,
          ctx.doc_id,
          ctx.oldDocLines,
          ctx.version,
          ctx.newRanges
        )
      })

      it('should upsert the ranges', ctx => {
        ctx.MongoManager.upsertIntoDocCollection
          .calledWith(ctx.project_id, ctx.doc_id, ctx.rev, {
            ranges: ctx.newRanges,
          })
          .should.equal(true)
      })

      it('should return the new rev', ctx => {
        expect(ctx.result).to.deep.equal({ modified: true, rev: ctx.rev + 1 })
      })
    })

    describe('when only the version has changed', () => {
      beforeEach(async ctx => {
        ctx.DocManager._getDoc = sinon.stub().resolves(ctx.doc)
        ctx.result = await ctx.DocManager.updateDoc(
          ctx.project_id,
          ctx.doc_id,
          ctx.oldDocLines,
          ctx.version + 1,
          ctx.originalRanges
        )
      })

      it('should update the version', ctx => {
        ctx.MongoManager.upsertIntoDocCollection.should.have.been.calledWith(
          ctx.project_id,
          ctx.doc_id,
          ctx.rev,
          { version: ctx.version + 1 }
        )
      })

      it('should return the old rev', ctx => {
        expect(ctx.result).to.deep.equal({ modified: true, rev: ctx.rev })
      })
    })

    describe('when the doc has not changed at all', () => {
      beforeEach(async ctx => {
        ctx.DocManager._getDoc = sinon.stub().resolves(ctx.doc)
        ctx.result = await ctx.DocManager.updateDoc(
          ctx.project_id,
          ctx.doc_id,
          ctx.oldDocLines,
          ctx.version,
          ctx.originalRanges
        )
      })

      it('should not update the ranges or lines or version', ctx => {
        ctx.MongoManager.upsertIntoDocCollection.called.should.equal(false)
      })

      it('should return the old rev and modified == false', ctx => {
        expect(ctx.result).to.deep.equal({ modified: false, rev: ctx.rev })
      })
    })

    describe('when the version is null', () => {
      it('should return an error', async ctx => {
        await expect(
          ctx.DocManager.updateDoc(
            ctx.project_id,
            ctx.doc_id,
            ctx.newDocLines,
            null,
            ctx.originalRanges
          )
        ).to.be.rejectedWith('no lines, version or ranges provided')
      })
    })

    describe('when the lines are null', () => {
      it('should return an error', async ctx => {
        await expect(
          ctx.DocManager.updateDoc(
            ctx.project_id,
            ctx.doc_id,
            null,
            ctx.version,
            ctx.originalRanges
          )
        ).to.be.rejectedWith('no lines, version or ranges provided')
      })
    })

    describe('when the ranges are null', () => {
      it('should return an error', async ctx => {
        await expect(
          ctx.DocManager.updateDoc(
            ctx.project_id,
            ctx.doc_id,
            ctx.newDocLines,
            ctx.version,
            null
          )
        ).to.be.rejectedWith('no lines, version or ranges provided')
      })
    })

    describe('when there is a generic error getting the doc', () => {
      beforeEach(async ctx => {
        ctx.error = new Error('doc could not be found')
        ctx.DocManager._getDoc = sinon.stub().rejects(ctx.error)
        await expect(
          ctx.DocManager.updateDoc(
            ctx.project_id,
            ctx.doc_id,
            ctx.newDocLines,
            ctx.version,
            ctx.originalRanges
          )
        ).to.be.rejectedWith(ctx.error)
      })

      it('should not upsert the document to the doc collection', ctx => {
        ctx.MongoManager.upsertIntoDocCollection.should.not.have.been.called
      })
    })

    describe('when the version was decremented', () => {
      it('should return an error', async ctx => {
        ctx.DocManager._getDoc = sinon.stub().resolves(ctx.doc)
        await expect(
          ctx.DocManager.updateDoc(
            ctx.project_id,
            ctx.doc_id,
            ctx.newDocLines,
            ctx.version - 1,
            ctx.originalRanges
          )
        ).to.be.rejectedWith(Errors.DocVersionDecrementedError)
      })
    })

    describe('when the doc lines have not changed', () => {
      beforeEach(async ctx => {
        ctx.DocManager._getDoc = sinon.stub().resolves(ctx.doc)
        ctx.result = await ctx.DocManager.updateDoc(
          ctx.project_id,
          ctx.doc_id,
          ctx.oldDocLines.slice(),
          ctx.version,
          ctx.originalRanges
        )
      })

      it('should not update the doc', ctx => {
        ctx.MongoManager.upsertIntoDocCollection.called.should.equal(false)
      })

      it('should return the existing rev', ctx => {
        expect(ctx.result).to.deep.equal({ modified: false, rev: ctx.rev })
      })
    })

    describe('when the doc does not exist', () => {
      beforeEach(async ctx => {
        ctx.DocManager._getDoc = sinon.stub().resolves(null)
        ctx.result = await ctx.DocManager.updateDoc(
          ctx.project_id,
          ctx.doc_id,
          ctx.newDocLines,
          ctx.version,
          ctx.originalRanges
        )
      })

      it('should upsert the document to the doc collection', ctx => {
        ctx.MongoManager.upsertIntoDocCollection.should.have.been.calledWith(
          ctx.project_id,
          ctx.doc_id,
          undefined,
          {
            lines: ctx.newDocLines,
            ranges: ctx.originalRanges,
            version: ctx.version,
          }
        )
      })

      it('should return the new rev', ctx => {
        expect(ctx.result).to.deep.equal({ modified: true, rev: 1 })
      })
    })

    describe('when another update is racing', () => {
      beforeEach(async ctx => {
        ctx.DocManager._getDoc = sinon.stub().resolves(ctx.doc)
        ctx.MongoManager.upsertIntoDocCollection
          .onFirstCall()
          .rejects(new Errors.DocRevValueError())
        ctx.RangeManager.shouldUpdateRanges.returns(true)
        ctx.result = await ctx.DocManager.updateDoc(
          ctx.project_id,
          ctx.doc_id,
          ctx.newDocLines,
          ctx.version + 1,
          ctx.newRanges
        )
      })

      it('should upsert the doc twice', ctx => {
        ctx.MongoManager.upsertIntoDocCollection.should.have.been.calledWith(
          ctx.project_id,
          ctx.doc_id,
          ctx.rev,
          {
            ranges: ctx.newRanges,
            lines: ctx.newDocLines,
            version: ctx.version + 1,
          }
        )
        ctx.MongoManager.upsertIntoDocCollection.should.have.been.calledTwice
      })

      it('should return the new rev', ctx => {
        expect(ctx.result).to.deep.equal({ modified: true, rev: ctx.rev + 1 })
      })
    })
  })
})
