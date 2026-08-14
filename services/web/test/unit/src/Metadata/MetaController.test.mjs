import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.mjs'
import { setReqValidationModeForTests } from '@overleaf/validation-tools'
const modulePath = '../../../../app/src/Features/Metadata/MetaController.mjs'

const PROJECT_ID = '507f1f77bcf86cd799439011'
const DOC_ID = '507f191e810c19729de860ea'

describe('MetaController', function () {
  beforeEach(async function (ctx) {
    ctx.EditorRealTimeController = {
      emitToRoom: sinon.stub(),
    }

    ctx.MetaHandler = {
      promises: {
        getAllMetaForProject: sinon.stub(),
        getMetaForDoc: sinon.stub(),
      },
    }

    vi.doMock(
      '../../../../app/src/Features/Editor/EditorRealTimeController',
      () => ({
        default: ctx.EditorRealTimeController,
      })
    )

    vi.doMock('../../../../app/src/Features/Metadata/MetaHandler', () => ({
      default: ctx.MetaHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({ default: {} })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: {
          promises: {
            getAssignment: sinon.stub().resolves({}),
          },
        },
      })
    )

    ctx.MetadataController = (await import(modulePath)).default
  })

  afterEach(function () {
    setReqValidationModeForTests(null)
  })

  describe('getMetadata', function () {
    it('should respond with json', async function (ctx) {
      const projectMeta = {
        'doc-id': {
          labels: ['foo'],
          packages: { a: { commands: [] } },
          packageNames: ['a'],
        },
      }

      ctx.MetaHandler.promises.getAllMetaForProject = sinon
        .stub()
        .resolves(projectMeta)

      const req = { params: { project_id: PROJECT_ID } }
      const res = new MockResponse(vi)
      const next = sinon.stub()

      await ctx.MetadataController.getMetadata(req, res, next)

      ctx.MetaHandler.promises.getAllMetaForProject.should.have.been.calledWith(
        PROJECT_ID
      )
      expect(res.json).toHaveBeenCalledTimes(1)
      expect(res.json).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        projectMeta,
      })
      next.should.not.have.been.called
    })

    it('should handle an error', async function (ctx) {
      ctx.MetaHandler.promises.getAllMetaForProject = sinon
        .stub()
        .throws(new Error('woops'))

      const req = { params: { project_id: PROJECT_ID } }
      const res = new MockResponse(vi)
      const next = sinon.stub()

      await ctx.MetadataController.getMetadata(req, res, next)

      ctx.MetaHandler.promises.getAllMetaForProject.should.have.been.calledWith(
        PROJECT_ID
      )
      expect(res.json).not.toHaveBeenCalled()
      next.should.have.been.calledWithMatch(error => error instanceof Error)
    })

    it('should reject a malformed project id', async function (ctx) {
      const req = { params: { project_id: 'not-an-object-id' } }
      const res = new MockResponse(vi)
      const next = sinon.stub()

      await ctx.MetadataController.getMetadata(req, res, next)

      expect(ctx.MetaHandler.promises.getAllMetaForProject.called).to.equal(
        false
      )
      next.should.have.been.calledWithMatch(
        error => error.name === 'InvalidParamsError'
      )
    })
  })

  describe('broadcastMetadataForDoc', function () {
    it('should broadcast on broadcast:true ', async function (ctx) {
      ctx.MetaHandler.promises.getMetaForDoc = sinon.stub().resolves({
        labels: ['foo'],
        packages: { a: { commands: [] } },
        packageNames: ['a'],
      })

      ctx.EditorRealTimeController.emitToRoom = sinon.stub()

      const req = {
        params: { project_id: PROJECT_ID, doc_id: DOC_ID },
        body: { broadcast: true },
      }
      const res = new MockResponse(vi)
      const next = sinon.stub()

      await ctx.MetadataController.broadcastMetadataForDoc(req, res, next)

      ctx.MetaHandler.promises.getMetaForDoc.should.have.been.calledWith(
        PROJECT_ID
      )
      expect(res.json).not.toHaveBeenCalled()
      expect(res.sendStatus).toHaveBeenCalledTimes(1)
      expect(res.sendStatus).toHaveBeenCalledWith(200)
      next.should.not.have.been.called

      ctx.EditorRealTimeController.emitToRoom.should.have.been.calledOnce
      const { lastCall } = ctx.EditorRealTimeController.emitToRoom
      expect(lastCall.args[0]).to.equal(PROJECT_ID)
      expect(lastCall.args[1]).to.equal('broadcastDocMeta')
      expect(lastCall.args[2]).to.have.all.keys(['docId', 'meta'])
    })

    it('should return json on broadcast:false ', async function (ctx) {
      const docMeta = {
        labels: ['foo'],
        packages: { a: [] },
        packageNames: ['a'],
      }

      ctx.MetaHandler.promises.getMetaForDoc = sinon.stub().resolves(docMeta)

      ctx.EditorRealTimeController.emitToRoom = sinon.stub()

      const req = {
        params: { project_id: PROJECT_ID, doc_id: DOC_ID },
        body: { broadcast: false },
      }
      const res = new MockResponse(vi)
      const next = sinon.stub()

      await ctx.MetadataController.broadcastMetadataForDoc(req, res, next)

      ctx.MetaHandler.promises.getMetaForDoc.should.have.been.calledWith(
        PROJECT_ID
      )
      ctx.EditorRealTimeController.emitToRoom.should.not.have.been.called
      expect(res.json).toHaveBeenCalledTimes(1)
      expect(res.json).toHaveBeenCalledWith({
        docId: DOC_ID,
        meta: docMeta,
      })
      next.should.not.have.been.called
    })

    it('should handle an error', async function (ctx) {
      ctx.MetaHandler.promises.getMetaForDoc = sinon
        .stub()
        .throws(new Error('woops'))

      ctx.EditorRealTimeController.emitToRoom = sinon.stub()

      const req = {
        params: { project_id: PROJECT_ID, doc_id: DOC_ID },
        body: { broadcast: true },
      }
      const res = new MockResponse(vi)
      const next = sinon.stub()

      await ctx.MetadataController.broadcastMetadataForDoc(req, res, next)

      ctx.MetaHandler.promises.getMetaForDoc.should.have.been.calledWith(
        PROJECT_ID
      )
      expect(res.json).not.toHaveBeenCalled()
      next.should.have.been.calledWithMatch(error => error instanceof Error)
    })

    describe('request validation', function () {
      beforeEach(function () {
        setReqValidationModeForTests('enforce')
      })

      it('should reject a malformed doc id', async function (ctx) {
        const req = {
          params: { project_id: PROJECT_ID, doc_id: 'not-an-object-id' },
          body: { broadcast: true },
        }
        const res = new MockResponse(vi)
        const next = sinon.stub()

        await ctx.MetadataController.broadcastMetadataForDoc(req, res, next)

        expect(ctx.MetaHandler.promises.getMetaForDoc.called).to.equal(false)
        next.should.have.been.calledWithMatch(
          error => error.name === 'InvalidParamsError'
        )
      })

      it('should reject an unrecognized body field', async function (ctx) {
        const req = {
          params: { project_id: PROJECT_ID, doc_id: DOC_ID },
          body: { broadcast: true, evil: 'x' },
        }
        const res = new MockResponse(vi)
        const next = sinon.stub()

        await ctx.MetadataController.broadcastMetadataForDoc(req, res, next)

        expect(ctx.MetaHandler.promises.getMetaForDoc.called).to.equal(false)
        next.should.have.been.calledWithMatch(
          error => error.name === 'InvalidRequestError'
        )
      })
    })
  })
})
