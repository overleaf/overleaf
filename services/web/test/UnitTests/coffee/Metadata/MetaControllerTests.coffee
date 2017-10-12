chai = require('chai')
chai.should()
expect = chai.expect
sinon = require("sinon")
modulePath = "../../../../app/js/Features/Metadata/MetaController"
SandboxedModule = require('sandboxed-module')


describe 'MetaController', ->
	beforeEach ->
		@projectId = 'somekindofid'
		@EditorRealTimeController = {
			emitToRoom: sinon.stub()
		}
		@MetaHandler = {
			getAllMetaForProject: sinon.stub()
			getMetaForDoc: sinon.stub()
		}
		@MetadataController = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': {log: sinon.stub(), err: sinon.stub()}
			'../Editor/EditorRealTimeController': @EditorRealTimeController
			'./MetaHandler': @MetaHandler

	describe 'getMetadata', ->
		beforeEach ->
			@fakeLabels = {'somedoc': ['a_label']}
			@MetaHandler.getAllMetaForProject = sinon.stub().callsArgWith(1, null, @fakeLabels)
			@req = {params: {project_id: @projectId}}
			@res = {json: sinon.stub()}
			@next = sinon.stub()

		it 'should call MetaHandler.getAllMetaForProject', () ->
			@MetadataController.getMetadata(@req, @res, @next)
			@MetaHandler.getAllMetaForProject.callCount.should.equal 1
			@MetaHandler.getAllMetaForProject.calledWith(@projectId).should.equal true

		it 'should call not call next with an error', () ->
			@MetadataController.getMetadata(@req, @res, @next)
			@next.callCount.should.equal 0

		it 'should send a json response', () ->
			@MetadataController.getMetadata(@req, @res, @next)
			@res.json.callCount.should.equal 1
			expect(@res.json.lastCall.args[0]).to.have.all.keys ['projectId', 'projectMeta']

		describe 'when MetaHandler.getAllMetaForProject produces an error', ->
			beforeEach ->
				@MetaHandler.getAllMetaForProject = sinon.stub().callsArgWith(1, new Error('woops'))
				@req = {params: {project_id: @projectId}}
				@res = {json: sinon.stub()}
				@next = sinon.stub()

			it 'should call MetaHandler.getAllMetaForProject', () ->
				@MetadataController.getMetadata(@req, @res, @next)
				@MetaHandler.getAllMetaForProject.callCount.should.equal 1
				@MetaHandler.getAllMetaForProject.calledWith(@projectId).should.equal true

			it 'should call next with an error', ->
				@MetadataController.getMetadata(@req, @res, @next)
				@next.callCount.should.equal 1
				expect(@next.lastCall.args[0]).to.be.instanceof Error

			it 'should not send a json response', ->
				@MetadataController.getMetadata(@req, @res, @next)
				@res.json.callCount.should.equal 0

	describe 'broadcastMetadataForDoc', ->
		beforeEach ->
			@MetaHandler.getMetaForDoc = sinon.stub().callsArgWith(2, null, @fakeLabels)
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@docId = 'somedoc'
			@req = {params: {project_id: @projectId, doc_id: @docId}}
			@res = {sendStatus: sinon.stub()}
			@next = sinon.stub()

		it 'should call MetaHandler.getMetaForDoc', () ->
			@MetadataController.broadcastMetadataForDoc(@req, @res, @next)
			@MetaHandler.getMetaForDoc.callCount.should.equal 1
			@MetaHandler.getMetaForDoc.calledWith(@projectId).should.equal true

		it 'should call not call next with an error', () ->
			@MetadataController.broadcastMetadataForDoc(@req, @res, @next)
			@next.callCount.should.equal 0

		it 'should send a success response', () ->
			@MetadataController.broadcastMetadataForDoc(@req, @res, @next)
			@res.sendStatus.callCount.should.equal 1
			@res.sendStatus.calledWith(200).should.equal true

		it 'should emit a message to room', () ->
			@MetadataController.broadcastMetadataForDoc(@req, @res, @next)
			@EditorRealTimeController.emitToRoom.callCount.should.equal 1
			lastCall = @EditorRealTimeController.emitToRoom.lastCall
			expect(lastCall.args[0]).to.equal @projectId
			expect(lastCall.args[1]).to.equal 'broadcastDocMeta'
			expect(lastCall.args[2]).to.have.all.keys ['docId', 'meta']

		describe 'when MetaHandler.getMetaForDoc produces an error', ->
			beforeEach ->
				@MetaHandler.getMetaForDoc = sinon.stub().callsArgWith(2, new Error('woops'))
				@EditorRealTimeController.emitToRoom = sinon.stub()
				@docId = 'somedoc'
				@req = {params: {project_id: @projectId, doc_id: @docId}}
				@res = {json: sinon.stub()}
				@next = sinon.stub()

			it 'should call MetaHandler.getMetaForDoc', () ->
				@MetadataController.broadcastMetadataForDoc(@req, @res, @next)
				@MetaHandler.getMetaForDoc.callCount.should.equal 1
				@MetaHandler.getMetaForDoc.calledWith(@projectId).should.equal true

			it 'should call next with an error', ->
				@MetadataController.broadcastMetadataForDoc(@req, @res, @next)
				@next.callCount.should.equal 1
				expect(@next.lastCall.args[0]).to.be.instanceof Error

			it 'should not send a json response', ->
				@MetadataController.broadcastMetadataForDoc(@req, @res, @next)
				@res.json.callCount.should.equal 0
