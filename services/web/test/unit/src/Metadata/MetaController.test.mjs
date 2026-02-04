import { expect, vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.mjs'
const modulePath = '../../../../app/src/Features/Metadata/MetaController.mjs'

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

    ctx.MetadataController = (await import(modulePath)).default
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

      const req = { params: { project_id: 'project-id' } }
      const res = new MockResponse(vi)
      const next = sinon.stub()

      await ctx.MetadataController.getMetadata(req, res, next)

      ctx.MetaHandler.promises.getAllMetaForProject.should.have.been.calledWith(
        'project-id'
      )
      expect(res.json).toHaveBeenCalledTimes(1)
      expect(res.json).toHaveBeenCalledWith({
        projectId: 'project-id',
        projectMeta,
      })
      next.should.not.have.been.called
    })

    it('should handle an error', async function (ctx) {
      ctx.MetaHandler.promises.getAllMetaForProject = sinon
        .stub()
        .throws(new Error('woops'))

      const req = { params: { project_id: 'project-id' } }
      const res = new MockResponse(vi)
      const next = sinon.stub()

      await ctx.MetadataController.getMetadata(req, res, next)

      ctx.MetaHandler.promises.getAllMetaForProject.should.have.been.calledWith(
        'project-id'
      )
      expect(res.json).not.toHaveBeenCalled()
      next.should.have.been.calledWithMatch(error => error instanceof Error)
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
        params: { project_id: 'project-id', doc_id: 'doc-id' },
        body: { broadcast: true },
      }
      const res = new MockResponse(vi)
      const next = sinon.stub()

      await ctx.MetadataController.broadcastMetadataForDoc(req, res, next)

      ctx.MetaHandler.promises.getMetaForDoc.should.have.been.calledWith(
        'project-id'
      )
      expect(res.json).not.toHaveBeenCalled()
      expect(res.sendStatus).toHaveBeenCalledTimes(1)
      expect(res.sendStatus).toHaveBeenCalledWith(200)
      next.should.not.have.been.called

      ctx.EditorRealTimeController.emitToRoom.should.have.been.calledOnce
      const { lastCall } = ctx.EditorRealTimeController.emitToRoom
      expect(lastCall.args[0]).to.equal('project-id')
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
        params: { project_id: 'project-id', doc_id: 'doc-id' },
        body: { broadcast: false },
      }
      const res = new MockResponse(vi)
      const next = sinon.stub()

      await ctx.MetadataController.broadcastMetadataForDoc(req, res, next)

      ctx.MetaHandler.promises.getMetaForDoc.should.have.been.calledWith(
        'project-id'
      )
      ctx.EditorRealTimeController.emitToRoom.should.not.have.been.called
      expect(res.json).toHaveBeenCalledTimes(1)
      expect(res.json).toHaveBeenCalledWith({
        docId: 'doc-id',
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
        params: { project_id: 'project-id', doc_id: 'doc-id' },
        body: { broadcast: true },
      }
      const res = new MockResponse(vi)
      const next = sinon.stub()

      await ctx.MetadataController.broadcastMetadataForDoc(req, res, next)

      ctx.MetaHandler.promises.getMetaForDoc.should.have.been.calledWith(
        'project-id'
      )
      expect(res.json).not.toHaveBeenCalled()
      next.should.have.been.calledWithMatch(error => error instanceof Error)
    })
  })
})
