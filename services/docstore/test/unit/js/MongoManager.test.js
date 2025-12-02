import sinon from 'sinon'
import { ObjectId } from 'mongodb-legacy'
import path from 'node:path'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import Errors from '../../../app/js/Errors.js'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/MongoManager'
)

describe('MongoManager', () => {
  beforeEach(async ctx => {
    ctx.db = {
      docs: {
        updateOne: sinon.stub().resolves({ matchedCount: 1 }),
        insertOne: sinon.stub().resolves(),
      },
    }

    vi.doMock('../../../app/js/mongodb', () => ({
      default: {
        db: ctx.db,
        ObjectId,
      },
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: {
        max_deleted_docs: 42,
        docstore: { archivingLockDurationMs: 5000 },
      },
    }))

    vi.doMock('../../../app/js/Errors', () => ({
      default: Errors,
    }))

    ctx.MongoManager = (await import(modulePath)).default
    ctx.projectId = new ObjectId().toString()
    ctx.docId = new ObjectId().toString()
    ctx.rev = 42
    ctx.stubbedErr = new Error('hello world')
    ctx.lines = ['Three French hens', 'Two turtle doves']
  })

  describe('findDoc', () => {
    beforeEach(async ctx => {
      ctx.doc = { name: 'mock-doc' }
      ctx.db.docs.findOne = sinon.stub().resolves(ctx.doc)
      ctx.filter = { lines: true }
      ctx.result = await ctx.MongoManager.findDoc(
        ctx.projectId,
        ctx.docId,
        ctx.filter
      )
    })

    it('should find the doc', ctx => {
      ctx.db.docs.findOne
        .calledWith(
          {
            _id: new ObjectId(ctx.docId),
            project_id: new ObjectId(ctx.projectId),
          },
          {
            projection: ctx.filter,
          }
        )
        .should.equal(true)
    })

    it('should return the doc', ctx => {
      expect(ctx.doc).to.deep.equal(ctx.doc)
    })
  })

  describe('patchDoc', () => {
    beforeEach(async ctx => {
      ctx.meta = { name: 'foo.tex' }
      await ctx.MongoManager.patchDoc(ctx.projectId, ctx.docId, ctx.meta)
    })

    it('should pass the parameter along', ctx => {
      ctx.db.docs.updateOne.should.have.been.calledWith(
        {
          _id: new ObjectId(ctx.docId),
          project_id: new ObjectId(ctx.projectId),
        },
        {
          $set: ctx.meta,
        }
      )
    })
  })

  describe('getProjectsDocs', () => {
    beforeEach(ctx => {
      ctx.filter = { lines: true }
      ctx.doc1 = { name: 'mock-doc1' }
      ctx.doc2 = { name: 'mock-doc2' }
      ctx.doc3 = { name: 'mock-doc3' }
      ctx.doc4 = { name: 'mock-doc4' }
      ctx.db.docs.find = sinon.stub().returns({
        toArray: sinon.stub().resolves([ctx.doc, ctx.doc3, ctx.doc4]),
      })
    })

    describe('with included_deleted = false', () => {
      beforeEach(async ctx => {
        ctx.result = await ctx.MongoManager.getProjectsDocs(
          ctx.projectId,
          { include_deleted: false },
          ctx.filter
        )
      })

      it('should find the non-deleted docs via the project_id', ctx => {
        ctx.db.docs.find
          .calledWith(
            {
              project_id: new ObjectId(ctx.projectId),
              deleted: { $ne: true },
            },
            {
              projection: ctx.filter,
            }
          )
          .should.equal(true)
      })

      it('should call return the docs', ctx => {
        expect(ctx.result).to.deep.equal([ctx.doc, ctx.doc3, ctx.doc4])
      })
    })

    describe('with included_deleted = true', () => {
      beforeEach(async ctx => {
        ctx.result = await ctx.MongoManager.getProjectsDocs(
          ctx.projectId,
          { include_deleted: true },
          ctx.filter
        )
      })

      it('should find all via the project_id', ctx => {
        ctx.db.docs.find
          .calledWith(
            {
              project_id: new ObjectId(ctx.projectId),
            },
            {
              projection: ctx.filter,
            }
          )
          .should.equal(true)
      })

      it('should return the docs', ctx => {
        expect(ctx.result).to.deep.equal([ctx.doc, ctx.doc3, ctx.doc4])
      })
    })
  })

  describe('getProjectsDeletedDocs', () => {
    beforeEach(async ctx => {
      ctx.filter = { name: true }
      ctx.doc1 = { _id: '1', name: 'mock-doc1.tex' }
      ctx.doc2 = { _id: '2', name: 'mock-doc2.tex' }
      ctx.doc3 = { _id: '3', name: 'mock-doc3.tex' }
      ctx.db.docs.find = sinon.stub().returns({
        toArray: sinon.stub().resolves([ctx.doc1, ctx.doc2, ctx.doc3]),
      })
      ctx.result = await ctx.MongoManager.getProjectsDeletedDocs(
        ctx.projectId,
        ctx.filter
      )
    })

    it('should find the deleted docs via the project_id', ctx => {
      ctx.db.docs.find
        .calledWith({
          project_id: new ObjectId(ctx.projectId),
          deleted: true,
        })
        .should.equal(true)
    })

    it('should filter, sort by deletedAt and limit', ctx => {
      ctx.db.docs.find
        .calledWith(sinon.match.any, {
          projection: ctx.filter,
          sort: { deletedAt: -1 },
          limit: 42,
        })
        .should.equal(true)
    })

    it('should return the docs', ctx => {
      expect(ctx.result).to.deep.equal([ctx.doc1, ctx.doc2, ctx.doc3])
    })
  })

  describe('upsertIntoDocCollection', () => {
    beforeEach(ctx => {
      ctx.oldRev = 77
    })

    it('should upsert the document', async ctx => {
      await ctx.MongoManager.upsertIntoDocCollection(
        ctx.projectId,
        ctx.docId,
        ctx.oldRev,
        { lines: ctx.lines }
      )

      const args = ctx.db.docs.updateOne.args[0]
      assert.deepEqual(args[0], {
        _id: new ObjectId(ctx.docId),
        project_id: new ObjectId(ctx.projectId),
        rev: ctx.oldRev,
      })
      assert.equal(args[1].$set.lines, ctx.lines)
      assert.equal(args[1].$inc.rev, 1)
    })

    it('should handle update error', async ctx => {
      ctx.db.docs.updateOne.rejects(ctx.stubbedErr)
      await expect(
        ctx.MongoManager.upsertIntoDocCollection(
          ctx.projectId,
          ctx.docId,
          ctx.rev,
          {
            lines: ctx.lines,
          }
        )
      ).to.be.rejectedWith(ctx.stubbedErr)
    })

    it('should insert without a previous rev', async ctx => {
      await ctx.MongoManager.upsertIntoDocCollection(
        ctx.projectId,
        ctx.docId,
        null,
        { lines: ctx.lines, ranges: ctx.ranges }
      )

      expect(ctx.db.docs.insertOne).to.have.been.calledWith({
        _id: new ObjectId(ctx.docId),
        project_id: new ObjectId(ctx.projectId),
        rev: 1,
        lines: ctx.lines,
        ranges: ctx.ranges,
      })
    })

    it('should handle generic insert error', async ctx => {
      ctx.db.docs.insertOne.rejects(ctx.stubbedErr)
      await expect(
        ctx.MongoManager.upsertIntoDocCollection(
          ctx.projectId,
          ctx.docId,
          null,
          { lines: ctx.lines, ranges: ctx.ranges }
        )
      ).to.be.rejectedWith(ctx.stubbedErr)
    })

    it('should handle duplicate insert error', async ctx => {
      ctx.db.docs.insertOne.rejects({ code: 11000 })
      await expect(
        ctx.MongoManager.upsertIntoDocCollection(
          ctx.projectId,
          ctx.docId,
          null,
          { lines: ctx.lines, ranges: ctx.ranges }
        )
      ).to.be.rejectedWith(Errors.DocRevValueError)
    })
  })

  describe('destroyProject', () => {
    beforeEach(async ctx => {
      ctx.projectId = new ObjectId()
      ctx.db.docs.deleteMany = sinon.stub().resolves()
      await ctx.MongoManager.destroyProject(ctx.projectId)
    })

    it('should destroy all docs', ctx => {
      sinon.assert.calledWith(ctx.db.docs.deleteMany, {
        project_id: ctx.projectId,
      })
    })
  })

  describe('checkRevUnchanged', ctx => {
    beforeEach(ctx => {
      ctx.doc = { _id: new ObjectId(), name: 'mock-doc', rev: 1 }
    })

    it('should not error when the rev has not changed', async ctx => {
      ctx.db.docs.findOne = sinon.stub().resolves({ rev: 1 })
      await ctx.MongoManager.checkRevUnchanged(ctx.doc)
    })

    it('should return an error when the rev has changed', async ctx => {
      ctx.db.docs.findOne = sinon.stub().resolves({ rev: 2 })
      await expect(
        ctx.MongoManager.checkRevUnchanged(ctx.doc)
      ).to.be.rejectedWith(Errors.DocModifiedError)
    })

    it('should return a value error if incoming rev is NaN', async ctx => {
      ctx.db.docs.findOne = sinon.stub().resolves({ rev: 2 })
      ctx.doc = { _id: new ObjectId(), name: 'mock-doc', rev: NaN }
      await expect(
        ctx.MongoManager.checkRevUnchanged(ctx.doc)
      ).to.be.rejectedWith(Errors.DocRevValueError)
    })

    it('should return a value error if checked doc rev is NaN', async ctx => {
      ctx.db.docs.findOne = sinon.stub().resolves({ rev: NaN })
      await expect(
        ctx.MongoManager.checkRevUnchanged(ctx.doc)
      ).to.be.rejectedWith(Errors.DocRevValueError)
    })
  })

  describe('restoreArchivedDoc', () => {
    beforeEach(ctx => {
      ctx.archivedDoc = {
        lines: ['a', 'b', 'c'],
        ranges: { some: 'ranges' },
        rev: 2,
      }
    })

    describe('complete doc', () => {
      beforeEach(async ctx => {
        await ctx.MongoManager.restoreArchivedDoc(
          ctx.projectId,
          ctx.docId,
          ctx.archivedDoc
        )
      })

      it('updates Mongo', ctx => {
        expect(ctx.db.docs.updateOne).to.have.been.calledWith(
          {
            _id: new ObjectId(ctx.docId),
            project_id: new ObjectId(ctx.projectId),
            rev: ctx.archivedDoc.rev,
          },
          {
            $set: {
              lines: ctx.archivedDoc.lines,
              ranges: ctx.archivedDoc.ranges,
            },
            $unset: {
              inS3: true,
            },
          }
        )
      })
    })

    describe('without ranges', () => {
      beforeEach(async ctx => {
        delete ctx.archivedDoc.ranges
        await ctx.MongoManager.restoreArchivedDoc(
          ctx.projectId,
          ctx.docId,
          ctx.archivedDoc
        )
      })

      it('sets ranges to an empty object', ctx => {
        expect(ctx.db.docs.updateOne).to.have.been.calledWith(
          {
            _id: new ObjectId(ctx.docId),
            project_id: new ObjectId(ctx.projectId),
            rev: ctx.archivedDoc.rev,
          },
          {
            $set: {
              lines: ctx.archivedDoc.lines,
              ranges: {},
            },
            $unset: {
              inS3: true,
            },
          }
        )
      })
    })

    describe("when the update doesn't succeed", () => {
      it('throws a DocRevValueError', async ctx => {
        ctx.db.docs.updateOne.resolves({ matchedCount: 0 })
        await expect(
          ctx.MongoManager.restoreArchivedDoc(
            ctx.projectId,
            ctx.docId,
            ctx.archivedDoc
          )
        ).to.be.rejectedWith(Errors.DocRevValueError)
      })
    })
  })
})
