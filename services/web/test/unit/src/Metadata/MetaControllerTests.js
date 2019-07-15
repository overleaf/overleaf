/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
chai.should()
const { expect } = chai
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Metadata/MetaController'
const SandboxedModule = require('sandboxed-module')

describe('MetaController', function() {
  beforeEach(function() {
    this.projectId = 'somekindofid'
    this.EditorRealTimeController = {
      emitToRoom: sinon.stub()
    }
    this.MetaHandler = {
      getAllMetaForProject: sinon.stub(),
      getMetaForDoc: sinon.stub()
    }
    return (this.MetadataController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': {
          log: sinon.stub(),
          warn: sinon.stub(),
          err: sinon.stub()
        },
        '../Editor/EditorRealTimeController': this.EditorRealTimeController,
        './MetaHandler': this.MetaHandler
      }
    }))
  })

  describe('getMetadata', function() {
    beforeEach(function() {
      this.fakeLabels = { somedoc: ['a_label'] }
      this.MetaHandler.getAllMetaForProject = sinon
        .stub()
        .callsArgWith(1, null, this.fakeLabels)
      this.req = { params: { project_id: this.projectId } }
      this.res = { json: sinon.stub() }
      return (this.next = sinon.stub())
    })

    it('should call MetaHandler.getAllMetaForProject', function() {
      this.MetadataController.getMetadata(this.req, this.res, this.next)
      this.MetaHandler.getAllMetaForProject.callCount.should.equal(1)
      return this.MetaHandler.getAllMetaForProject
        .calledWith(this.projectId)
        .should.equal(true)
    })

    it('should call not call next with an error', function() {
      this.MetadataController.getMetadata(this.req, this.res, this.next)
      return this.next.callCount.should.equal(0)
    })

    it('should send a json response', function() {
      this.MetadataController.getMetadata(this.req, this.res, this.next)
      this.res.json.callCount.should.equal(1)
      return expect(this.res.json.lastCall.args[0]).to.have.all.keys([
        'projectId',
        'projectMeta'
      ])
    })

    describe('when MetaHandler.getAllMetaForProject produces an error', function() {
      beforeEach(function() {
        this.MetaHandler.getAllMetaForProject = sinon
          .stub()
          .callsArgWith(1, new Error('woops'))
        this.req = { params: { project_id: this.projectId } }
        this.res = { json: sinon.stub() }
        return (this.next = sinon.stub())
      })

      it('should call MetaHandler.getAllMetaForProject', function() {
        this.MetadataController.getMetadata(this.req, this.res, this.next)
        this.MetaHandler.getAllMetaForProject.callCount.should.equal(1)
        return this.MetaHandler.getAllMetaForProject
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should call next with an error', function() {
        this.MetadataController.getMetadata(this.req, this.res, this.next)
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should not send a json response', function() {
        this.MetadataController.getMetadata(this.req, this.res, this.next)
        return this.res.json.callCount.should.equal(0)
      })
    })
  })

  describe('broadcastMetadataForDoc', function() {
    beforeEach(function() {
      this.MetaHandler.getMetaForDoc = sinon
        .stub()
        .callsArgWith(2, null, this.fakeLabels)
      this.EditorRealTimeController.emitToRoom = sinon.stub()
      this.docId = 'somedoc'
      this.req = { params: { project_id: this.projectId, doc_id: this.docId } }
      this.res = { sendStatus: sinon.stub() }
      return (this.next = sinon.stub())
    })

    it('should call MetaHandler.getMetaForDoc', function() {
      this.MetadataController.broadcastMetadataForDoc(
        this.req,
        this.res,
        this.next
      )
      this.MetaHandler.getMetaForDoc.callCount.should.equal(1)
      return this.MetaHandler.getMetaForDoc
        .calledWith(this.projectId)
        .should.equal(true)
    })

    it('should call not call next with an error', function() {
      this.MetadataController.broadcastMetadataForDoc(
        this.req,
        this.res,
        this.next
      )
      return this.next.callCount.should.equal(0)
    })

    it('should send a success response', function() {
      this.MetadataController.broadcastMetadataForDoc(
        this.req,
        this.res,
        this.next
      )
      this.res.sendStatus.callCount.should.equal(1)
      return this.res.sendStatus.calledWith(200).should.equal(true)
    })

    it('should emit a message to room', function() {
      this.MetadataController.broadcastMetadataForDoc(
        this.req,
        this.res,
        this.next
      )
      this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
      const { lastCall } = this.EditorRealTimeController.emitToRoom
      expect(lastCall.args[0]).to.equal(this.projectId)
      expect(lastCall.args[1]).to.equal('broadcastDocMeta')
      return expect(lastCall.args[2]).to.have.all.keys(['docId', 'meta'])
    })

    describe('when MetaHandler.getMetaForDoc produces an error', function() {
      beforeEach(function() {
        this.MetaHandler.getMetaForDoc = sinon
          .stub()
          .callsArgWith(2, new Error('woops'))
        this.EditorRealTimeController.emitToRoom = sinon.stub()
        this.docId = 'somedoc'
        this.req = {
          params: { project_id: this.projectId, doc_id: this.docId }
        }
        this.res = { json: sinon.stub() }
        return (this.next = sinon.stub())
      })

      it('should call MetaHandler.getMetaForDoc', function() {
        this.MetadataController.broadcastMetadataForDoc(
          this.req,
          this.res,
          this.next
        )
        this.MetaHandler.getMetaForDoc.callCount.should.equal(1)
        return this.MetaHandler.getMetaForDoc
          .calledWith(this.projectId)
          .should.equal(true)
      })

      it('should call next with an error', function() {
        this.MetadataController.broadcastMetadataForDoc(
          this.req,
          this.res,
          this.next
        )
        this.next.callCount.should.equal(1)
        return expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should not send a json response', function() {
        this.MetadataController.broadcastMetadataForDoc(
          this.req,
          this.res,
          this.next
        )
        return this.res.json.callCount.should.equal(0)
      })
    })
  })
})
