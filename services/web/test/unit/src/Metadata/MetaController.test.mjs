import { expect } from 'chai'
import sinon from 'sinon'
import esmock from 'esmock'
import MockResponse from '../helpers/MockResponse.js'
const modulePath = '../../../../app/src/Features/Metadata/MetaController.mjs'

describe('MetaController', function () {
  beforeEach(async function () {
    this.EditorRealTimeController = {
      emitToRoom: sinon.stub(),
    }

    this.MetaHandler = {
      promises: {
        getAllMetaForProject: sinon.stub(),
        getMetaForDoc: sinon.stub(),
      },
    }

    this.MetadataController = await esmock.strict(modulePath, {
      '../../../../app/src/Features/Editor/EditorRealTimeController':
        this.EditorRealTimeController,
      '../../../../app/src/Features/Metadata/MetaHandler': this.MetaHandler,
    })
  })

  describe('getMetadata', function () {
    it('should respond with json', async function () {
      const projectMeta = {
        'doc-id': {
          labels: ['foo'],
          packages: { a: { commands: [] } },
          packageNames: ['a'],
        },
      }

      this.MetaHandler.promises.getAllMetaForProject = sinon
        .stub()
        .resolves(projectMeta)

      const req = { params: { project_id: 'project-id' } }
      const res = new MockResponse()
      const next = sinon.stub()

      await this.MetadataController.getMetadata(req, res, next)

      this.MetaHandler.promises.getAllMetaForProject.should.have.been.calledWith(
        'project-id'
      )
      res.json.should.have.been.calledOnceWith({
        projectId: 'project-id',
        projectMeta,
      })
      next.should.not.have.been.called
    })

    it('should handle an error', async function () {
      this.MetaHandler.promises.getAllMetaForProject = sinon
        .stub()
        .throws(new Error('woops'))

      const req = { params: { project_id: 'project-id' } }
      const res = new MockResponse()
      const next = sinon.stub()

      await this.MetadataController.getMetadata(req, res, next)

      this.MetaHandler.promises.getAllMetaForProject.should.have.been.calledWith(
        'project-id'
      )
      res.json.should.not.have.been.called
      next.should.have.been.calledWithMatch(error => error instanceof Error)
    })
  })

  describe('broadcastMetadataForDoc', function () {
    it('should broadcast on broadcast:true ', async function () {
      this.MetaHandler.promises.getMetaForDoc = sinon.stub().resolves({
        labels: ['foo'],
        packages: { a: { commands: [] } },
        packageNames: ['a'],
      })

      this.EditorRealTimeController.emitToRoom = sinon.stub()

      const req = {
        params: { project_id: 'project-id', doc_id: 'doc-id' },
        body: { broadcast: true },
      }
      const res = new MockResponse()
      const next = sinon.stub()

      await this.MetadataController.broadcastMetadataForDoc(req, res, next)

      this.MetaHandler.promises.getMetaForDoc.should.have.been.calledWith(
        'project-id'
      )
      res.json.should.not.have.been.called
      res.sendStatus.should.have.been.calledOnceWith(200)
      next.should.not.have.been.called

      this.EditorRealTimeController.emitToRoom.should.have.been.calledOnce
      const { lastCall } = this.EditorRealTimeController.emitToRoom
      expect(lastCall.args[0]).to.equal('project-id')
      expect(lastCall.args[1]).to.equal('broadcastDocMeta')
      expect(lastCall.args[2]).to.have.all.keys(['docId', 'meta'])
    })

    it('should return json on broadcast:false ', async function () {
      const docMeta = {
        labels: ['foo'],
        packages: { a: [] },
        packageNames: ['a'],
      }

      this.MetaHandler.promises.getMetaForDoc = sinon.stub().resolves(docMeta)

      this.EditorRealTimeController.emitToRoom = sinon.stub()

      const req = {
        params: { project_id: 'project-id', doc_id: 'doc-id' },
        body: { broadcast: false },
      }
      const res = new MockResponse()
      const next = sinon.stub()

      await this.MetadataController.broadcastMetadataForDoc(req, res, next)

      this.MetaHandler.promises.getMetaForDoc.should.have.been.calledWith(
        'project-id'
      )
      this.EditorRealTimeController.emitToRoom.should.not.have.been.called
      res.json.should.have.been.calledOnceWith({
        docId: 'doc-id',
        meta: docMeta,
      })
      next.should.not.have.been.called
    })

    it('should handle an error', async function () {
      this.MetaHandler.promises.getMetaForDoc = sinon
        .stub()
        .throws(new Error('woops'))

      this.EditorRealTimeController.emitToRoom = sinon.stub()

      const req = {
        params: { project_id: 'project-id', doc_id: 'doc-id' },
        body: { broadcast: true },
      }
      const res = new MockResponse()
      const next = sinon.stub()

      await this.MetadataController.broadcastMetadataForDoc(req, res, next)

      this.MetaHandler.promises.getMetaForDoc.should.have.been.calledWith(
        'project-id'
      )
      res.json.should.not.have.been.called
      next.should.have.been.calledWithMatch(error => error instanceof Error)
    })
  })
})
