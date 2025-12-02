import sinon from 'sinon'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { ObjectId } from 'mongodb-legacy'
import Errors from '../../../app/js/Errors.js'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/HttpController'
)

describe('HttpController', () => {
  beforeEach(async ctx => {
    const settings = {
      max_doc_length: 2 * 1024 * 1024,
    }
    ctx.DocArchiveManager = {
      unArchiveAllDocs: sinon.stub().returns(),
    }
    ctx.DocManager = {}

    vi.doMock('../../../app/js/DocManager', () => ({
      default: ctx.DocManager,
    }))

    vi.doMock('../../../app/js/DocArchiveManager', () => ({
      default: ctx.DocArchiveManager,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: settings,
    }))

    vi.doMock('../../../app/js/HealthChecker', () => ({
      default: {},
    }))

    vi.doMock('../../../app/js/Errors', () => ({
      default: Errors,
    }))

    ctx.HttpController = (await import(modulePath)).default
    ctx.res = {
      send: sinon.stub(),
      sendStatus: sinon.stub(),
      json: sinon.stub(),
      setHeader: sinon.stub(),
    }
    ctx.res.status = sinon.stub().returns(ctx.res)
    ctx.req = { query: {} }
    ctx.next = sinon.stub()
    ctx.projectId = 'mock-project-id'
    ctx.docId = 'mock-doc-id'
    ctx.doc = {
      _id: ctx.docId,
      lines: ['mock', 'lines', ' here', '', '', ' spaces '],
      version: 42,
      rev: 5,
    }
    ctx.deletedDoc = {
      deleted: true,
      _id: ctx.docId,
      lines: ['mock', 'lines', ' here', '', '', ' spaces '],
      version: 42,
      rev: 5,
    }
  })

  describe('getDoc', () => {
    describe('without deleted docs', () => {
      beforeEach(async ctx => {
        ctx.req.params = {
          project_id: ctx.projectId,
          doc_id: ctx.docId,
        }
        ctx.DocManager.getFullDoc = sinon.stub().resolves(ctx.doc)
        await ctx.HttpController.getDoc(ctx.req, ctx.res, ctx.next)
      })

      it('should get the document with the version (including deleted)', ctx => {
        ctx.DocManager.getFullDoc
          .calledWith(ctx.projectId, ctx.docId)
          .should.equal(true)
      })

      it('should return the doc as JSON', ctx => {
        ctx.res.json
          .calledWith({
            _id: ctx.docId,
            lines: ctx.doc.lines,
            rev: ctx.doc.rev,
            version: ctx.doc.version,
          })
          .should.equal(true)
      })
    })

    describe('which is deleted', () => {
      beforeEach(ctx => {
        ctx.req.params = {
          project_id: ctx.projectId,
          doc_id: ctx.docId,
        }
        ctx.DocManager.getFullDoc = sinon.stub().resolves(ctx.deletedDoc)
      })

      it('should get the doc from the doc manager', async ctx => {
        await ctx.HttpController.getDoc(ctx.req, ctx.res, ctx.next)
        ctx.DocManager.getFullDoc
          .calledWith(ctx.projectId, ctx.docId)
          .should.equal(true)
      })

      it('should return 404 if the query string delete is not set ', async ctx => {
        await ctx.HttpController.getDoc(ctx.req, ctx.res, ctx.next)
        ctx.res.sendStatus.calledWith(404).should.equal(true)
      })

      it('should return the doc as JSON if include_deleted is set to true', async ctx => {
        ctx.req.query.include_deleted = 'true'
        await ctx.HttpController.getDoc(ctx.req, ctx.res, ctx.next)
        ctx.res.json
          .calledWith({
            _id: ctx.docId,
            lines: ctx.doc.lines,
            rev: ctx.doc.rev,
            deleted: true,
            version: ctx.doc.version,
          })
          .should.equal(true)
      })
    })
  })

  describe('getRawDoc', () => {
    beforeEach(async ctx => {
      ctx.req.params = {
        project_id: ctx.projectId,
        doc_id: ctx.docId,
      }
      ctx.DocManager.getDocLines = sinon
        .stub()
        .resolves(ctx.doc.lines.join('\n'))
      await ctx.HttpController.getRawDoc(ctx.req, ctx.res, ctx.next)
    })

    it('should get the document without the version', ctx => {
      ctx.DocManager.getDocLines
        .calledWith(ctx.projectId, ctx.docId)
        .should.equal(true)
    })

    it('should set the content type header', ctx => {
      ctx.res.setHeader
        .calledWith('content-type', 'text/plain')
        .should.equal(true)
    })

    it('should send the raw version of the doc', ctx => {
      assert.deepEqual(
        ctx.res.send.args[0][0],
        `${ctx.doc.lines[0]}\n${ctx.doc.lines[1]}\n${ctx.doc.lines[2]}\n${ctx.doc.lines[3]}\n${ctx.doc.lines[4]}\n${ctx.doc.lines[5]}`
      )
    })
  })

  describe('getAllDocs', () => {
    describe('normally', () => {
      beforeEach(async ctx => {
        ctx.req.params = { project_id: ctx.projectId }
        ctx.docs = [
          {
            _id: new ObjectId(),
            lines: ['mock', 'lines', 'one'],
            rev: 2,
          },
          {
            _id: new ObjectId(),
            lines: ['mock', 'lines', 'two'],
            rev: 4,
          },
        ]
        ctx.DocManager.getAllNonDeletedDocs = sinon.stub().resolves(ctx.docs)
        await ctx.HttpController.getAllDocs(ctx.req, ctx.res, ctx.next)
      })

      it('should get all the (non-deleted) docs', ctx => {
        ctx.DocManager.getAllNonDeletedDocs
          .calledWith(ctx.projectId, { lines: true, rev: true })
          .should.equal(true)
      })

      it('should return the doc as JSON', ctx => {
        ctx.res.json
          .calledWith([
            {
              _id: ctx.docs[0]._id.toString(),
              lines: ctx.docs[0].lines,
              rev: ctx.docs[0].rev,
            },
            {
              _id: ctx.docs[1]._id.toString(),
              lines: ctx.docs[1].lines,
              rev: ctx.docs[1].rev,
            },
          ])
          .should.equal(true)
      })
    })

    describe('with null lines', () => {
      beforeEach(async ctx => {
        ctx.req.params = { project_id: ctx.projectId }
        ctx.docs = [
          {
            _id: new ObjectId(),
            lines: null,
            rev: 2,
          },
          {
            _id: new ObjectId(),
            lines: ['mock', 'lines', 'two'],
            rev: 4,
          },
        ]
        ctx.DocManager.getAllNonDeletedDocs = sinon.stub().resolves(ctx.docs)
        await ctx.HttpController.getAllDocs(ctx.req, ctx.res, ctx.next)
      })

      it('should return the doc with fallback lines', ctx => {
        ctx.res.json
          .calledWith([
            {
              _id: ctx.docs[0]._id.toString(),
              lines: [],
              rev: ctx.docs[0].rev,
            },
            {
              _id: ctx.docs[1]._id.toString(),
              lines: ctx.docs[1].lines,
              rev: ctx.docs[1].rev,
            },
          ])
          .should.equal(true)
      })
    })

    describe('with a null doc', () => {
      beforeEach(async ctx => {
        ctx.req.params = { project_id: ctx.projectId }
        ctx.docs = [
          {
            _id: new ObjectId(),
            lines: ['mock', 'lines', 'one'],
            rev: 2,
          },
          null,
          {
            _id: new ObjectId(),
            lines: ['mock', 'lines', 'two'],
            rev: 4,
          },
        ]
        ctx.DocManager.getAllNonDeletedDocs = sinon.stub().resolves(ctx.docs)
        await ctx.HttpController.getAllDocs(ctx.req, ctx.res, ctx.next)
      })

      it('should return the non null docs as JSON', ctx => {
        ctx.res.json
          .calledWith([
            {
              _id: ctx.docs[0]._id.toString(),
              lines: ctx.docs[0].lines,
              rev: ctx.docs[0].rev,
            },
            {
              _id: ctx.docs[2]._id.toString(),
              lines: ctx.docs[2].lines,
              rev: ctx.docs[2].rev,
            },
          ])
          .should.equal(true)
      })

      it('should log out an error', ctx => {
        ctx.logger.error
          .calledWith(
            {
              err: sinon.match.has('message', 'null doc'),
              projectId: ctx.projectId,
            },
            'encountered null doc'
          )
          .should.equal(true)
      })
    })
  })

  describe('getAllRanges', () => {
    describe('normally', () => {
      beforeEach(async ctx => {
        ctx.req.params = { project_id: ctx.projectId }
        ctx.docs = [
          {
            _id: new ObjectId(),
            ranges: { mock_ranges: 'one' },
          },
          {
            _id: new ObjectId(),
            ranges: { mock_ranges: 'two' },
          },
        ]
        ctx.DocManager.getAllNonDeletedDocs = sinon.stub().resolves(ctx.docs)
        await ctx.HttpController.getAllRanges(ctx.req, ctx.res, ctx.next)
      })

      it('should get all the (non-deleted) doc ranges', ctx => {
        ctx.DocManager.getAllNonDeletedDocs
          .calledWith(ctx.projectId, { ranges: true })
          .should.equal(true)
      })

      it('should return the doc as JSON', ctx => {
        ctx.res.json
          .calledWith([
            {
              _id: ctx.docs[0]._id.toString(),
              ranges: ctx.docs[0].ranges,
            },
            {
              _id: ctx.docs[1]._id.toString(),
              ranges: ctx.docs[1].ranges,
            },
          ])
          .should.equal(true)
      })
    })
  })

  describe('updateDoc', () => {
    beforeEach(ctx => {
      ctx.req.params = {
        project_id: ctx.projectId,
        doc_id: ctx.docId,
      }
    })

    describe('when the doc lines exist and were updated', () => {
      beforeEach(async ctx => {
        ctx.req.body = {
          lines: (ctx.lines = ['hello', 'world']),
          version: (ctx.version = 42),
          ranges: (ctx.ranges = { changes: 'mock' }),
        }
        ctx.rev = 5
        ctx.DocManager.updateDoc = sinon
          .stub()
          .resolves({ modified: true, rev: ctx.rev })
        await ctx.HttpController.updateDoc(ctx.req, ctx.res, ctx.next)
      })

      it('should update the document', ctx => {
        ctx.DocManager.updateDoc
          .calledWith(
            ctx.projectId,
            ctx.docId,
            ctx.lines,
            ctx.version,
            ctx.ranges
          )
          .should.equal(true)
      })

      it('should return a modified status', ctx => {
        ctx.res.json
          .calledWith({ modified: true, rev: ctx.rev })
          .should.equal(true)
      })
    })

    describe('when the doc lines exist and were not updated', () => {
      beforeEach(async ctx => {
        ctx.req.body = {
          lines: (ctx.lines = ['hello', 'world']),
          version: (ctx.version = 42),
          ranges: {},
        }
        ctx.rev = 5
        ctx.DocManager.updateDoc = sinon
          .stub()
          .resolves({ modified: false, rev: ctx.rev })
        await ctx.HttpController.updateDoc(ctx.req, ctx.res, ctx.next)
      })

      it('should return a modified status', ctx => {
        ctx.res.json
          .calledWith({ modified: false, rev: ctx.rev })
          .should.equal(true)
      })
    })

    describe('when the doc lines are not provided', () => {
      beforeEach(async ctx => {
        ctx.req.body = { version: 42, ranges: {} }
        ctx.DocManager.updateDoc = sinon
          .stub()
          .resolves({ modified: false, rev: 0 })
        await ctx.HttpController.updateDoc(ctx.req, ctx.res, ctx.next)
      })

      it('should not update the document', ctx => {
        ctx.DocManager.updateDoc.called.should.equal(false)
      })

      it('should return a 400 (bad request) response', ctx => {
        ctx.res.sendStatus.calledWith(400).should.equal(true)
      })
    })

    describe('when the doc version are not provided', () => {
      beforeEach(async ctx => {
        ctx.req.body = { version: 42, lines: ['hello world'] }
        ctx.DocManager.updateDoc = sinon
          .stub()
          .resolves({ modified: false, rev: 0 })
        await ctx.HttpController.updateDoc(ctx.req, ctx.res, ctx.next)
      })

      it('should not update the document', ctx => {
        ctx.DocManager.updateDoc.called.should.equal(false)
      })

      it('should return a 400 (bad request) response', ctx => {
        ctx.res.sendStatus.calledWith(400).should.equal(true)
      })
    })

    describe('when the doc ranges is not provided', () => {
      beforeEach(async ctx => {
        ctx.req.body = { lines: ['foo'], version: 42 }
        ctx.DocManager.updateDoc = sinon
          .stub()
          .resolves({ modified: false, rev: 0 })
        await ctx.HttpController.updateDoc(ctx.req, ctx.res, ctx.next)
      })

      it('should not update the document', ctx => {
        ctx.DocManager.updateDoc.called.should.equal(false)
      })

      it('should return a 400 (bad request) response', ctx => {
        ctx.res.sendStatus.calledWith(400).should.equal(true)
      })
    })

    describe('when the doc body is too large', () => {
      beforeEach(async ctx => {
        ctx.req.body = {
          lines: (ctx.lines = Array(2049).fill('a'.repeat(1024))),
          version: (ctx.version = 42),
          ranges: (ctx.ranges = { changes: 'mock' }),
        }
        ctx.DocManager.updateDoc = sinon
          .stub()
          .resolves({ modified: false, rev: 0 })
        await ctx.HttpController.updateDoc(ctx.req, ctx.res, ctx.next)
      })

      it('should not update the document', ctx => {
        ctx.DocManager.updateDoc.called.should.equal(false)
      })

      it('should return a 413 (too large) response', ctx => {
        sinon.assert.calledWith(ctx.res.status, 413)
      })

      it('should report that the document body is too large', ctx => {
        sinon.assert.calledWith(ctx.res.send, 'document body too large')
      })
    })
  })

  describe('patchDoc', () => {
    beforeEach(async ctx => {
      ctx.req.params = {
        project_id: ctx.projectId,
        doc_id: ctx.docId,
      }
      ctx.req.body = { name: 'foo.tex' }
      ctx.DocManager.patchDoc = sinon.stub().resolves()
      await ctx.HttpController.patchDoc(ctx.req, ctx.res, ctx.next)
    })

    it('should delete the document', ctx => {
      expect(ctx.DocManager.patchDoc).to.have.been.calledWith(
        ctx.projectId,
        ctx.docId
      )
    })

    it('should return a 204 (No Content)', ctx => {
      expect(ctx.res.sendStatus).to.have.been.calledWith(204)
    })

    describe('with an invalid payload', () => {
      beforeEach(async ctx => {
        ctx.req.body = { cannot: 'happen' }

        ctx.DocManager.patchDoc = sinon.stub().resolves()
        await ctx.HttpController.patchDoc(ctx.req, ctx.res, ctx.next)
      })

      it('should log a message', ctx => {
        expect(ctx.logger.fatal).to.have.been.calledWith(
          { field: 'cannot' },
          'joi validation for pathDoc is broken'
        )
      })

      it('should not pass the invalid field along', ctx => {
        expect(ctx.DocManager.patchDoc).to.have.been.calledWith(
          ctx.projectId,
          ctx.docId,
          {}
        )
      })
    })
  })

  describe('archiveAllDocs', () => {
    beforeEach(async ctx => {
      ctx.req.params = { project_id: ctx.projectId }
      ctx.DocArchiveManager.archiveAllDocs = sinon.stub().resolves()
      await ctx.HttpController.archiveAllDocs(ctx.req, ctx.res, ctx.next)
    })

    it('should archive the project', ctx => {
      ctx.DocArchiveManager.archiveAllDocs
        .calledWith(ctx.projectId)
        .should.equal(true)
    })

    it('should return a 204 (No Content)', ctx => {
      ctx.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('unArchiveAllDocs', () => {
    beforeEach(ctx => {
      ctx.req.params = { project_id: ctx.projectId }
    })

    describe('on success', () => {
      beforeEach(async ctx => {
        await ctx.HttpController.unArchiveAllDocs(ctx.req, ctx.res, ctx.next)
      })

      it('returns a 200', ctx => {
        expect(ctx.res.sendStatus).to.have.been.calledWith(200)
      })
    })

    describe("when the archived rev doesn't match", () => {
      beforeEach(async ctx => {
        ctx.DocArchiveManager.unArchiveAllDocs.rejects(
          new Errors.DocRevValueError('bad rev')
        )
        await ctx.HttpController.unArchiveAllDocs(ctx.req, ctx.res, ctx.next)
      })

      it('returns a 409', ctx => {
        expect(ctx.res.sendStatus).to.have.been.calledWith(409)
      })
    })
  })

  describe('destroyProject', () => {
    beforeEach(async ctx => {
      ctx.req.params = { project_id: ctx.projectId }
      ctx.DocArchiveManager.destroyProject = sinon.stub().resolves()
      await ctx.HttpController.destroyProject(ctx.req, ctx.res, ctx.next)
    })

    it('should destroy the docs', ctx => {
      sinon.assert.calledWith(
        ctx.DocArchiveManager.destroyProject,
        ctx.projectId
      )
    })

    it('should return 204', ctx => {
      sinon.assert.calledWith(ctx.res.sendStatus, 204)
    })
  })
})
