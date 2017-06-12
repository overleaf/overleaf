chai = require('chai')
chai.should()
expect = chai.expect
sinon = require("sinon")
modulePath = "../../../../app/js/Features/Labels/LabelsController"
SandboxedModule = require('sandboxed-module')


describe 'LabelsController', ->
	beforeEach ->
		@projectId = 'somekindofid'
		@EditorRealTimeController = {
			emitToRoom: sinon.stub()
		}
		@LabelsHandler = {
			getAllLabelsForProject: sinon.stub()
			getLabelsForDoc: sinon.stub()
		}
		@LabelsController = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': {log: sinon.stub(), err: sinon.stub()}
			'../Editor/EditorRealTimeController': @EditorRealTimeController
			'./LabelsHandler': @LabelsHandler

	describe 'getAllLabels', ->
		beforeEach ->
			@fakeLabels = {'somedoc': ['a_label']}
			@LabelsHandler.getAllLabelsForProject = sinon.stub().callsArgWith(1, null, @fakeLabels)
			@req = {params: {project_id: @projectId}}
			@res = {json: sinon.stub()}
			@next = sinon.stub()

		it 'should call LabelsHandler.getAllLabelsForProject', () ->
			@LabelsController.getAllLabels(@req, @res, @next)
			@LabelsHandler.getAllLabelsForProject.callCount.should.equal 1
			@LabelsHandler.getAllLabelsForProject.calledWith(@projectId).should.equal true

		it 'should call not call next with an error', () ->
			@LabelsController.getAllLabels(@req, @res, @next)
			@next.callCount.should.equal 0

		it 'should send a json response', () ->
			@LabelsController.getAllLabels(@req, @res, @next)
			@res.json.callCount.should.equal 1
			expect(@res.json.lastCall.args[0]).to.have.all.keys ['projectId', 'projectLabels']

		describe 'when LabelsHandler.getAllLabelsForProject produces an error', ->
			beforeEach ->
				@LabelsHandler.getAllLabelsForProject = sinon.stub().callsArgWith(1, new Error('woops'))
				@req = {params: {project_id: @projectId}}
				@res = {json: sinon.stub()}
				@next = sinon.stub()

			it 'should call LabelsHandler.getAllLabelsForProject', () ->
				@LabelsController.getAllLabels(@req, @res, @next)
				@LabelsHandler.getAllLabelsForProject.callCount.should.equal 1
				@LabelsHandler.getAllLabelsForProject.calledWith(@projectId).should.equal true

			it 'should call next with an error', ->
				@LabelsController.getAllLabels(@req, @res, @next)
				@next.callCount.should.equal 1
				expect(@next.lastCall.args[0]).to.be.instanceof Error

			it 'should not send a json response', ->
				@LabelsController.getAllLabels(@req, @res, @next)
				@res.json.callCount.should.equal 0

	describe 'getLabelsForDoc', ->
		beforeEach ->
			@LabelsHandler.getLabelsForDoc = sinon.stub().callsArgWith(2, null, @fakeLabels)
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@docId = 'somedoc'
			@req = {params: {project_id: @projectId, doc_id: @docId}}
			@res = {json: sinon.stub()}
			@next = sinon.stub()

		it 'should call LabelsHandler.getLabelsForDoc', () ->
			@LabelsController.getLabelsForDoc(@req, @res, @next)
			@LabelsHandler.getLabelsForDoc.callCount.should.equal 1
			@LabelsHandler.getLabelsForDoc.calledWith(@projectId).should.equal true

		it 'should call not call next with an error', () ->
			@LabelsController.getLabelsForDoc(@req, @res, @next)
			@next.callCount.should.equal 0

		it 'should send a json response', () ->
			@LabelsController.getLabelsForDoc(@req, @res, @next)
			@res.json.callCount.should.equal 1
			expect(@res.json.lastCall.args[0]).to.have.all.keys ['projectId', 'docId', 'labels']

		it 'should emit a message to room', () ->
			@LabelsController.getLabelsForDoc(@req, @res, @next)
			@EditorRealTimeController.emitToRoom.callCount.should.equal 1
			lastCall = @EditorRealTimeController.emitToRoom.lastCall
			expect(lastCall.args[0]).to.equal @projectId
			expect(lastCall.args[1]).to.equal 'docLabelsUpdated'
			expect(lastCall.args[2]).to.have.all.keys ['docId', 'labels']

		describe 'when LabelsHandler.getLabelsForDoc produces an error', ->
			beforeEach ->
				@LabelsHandler.getLabelsForDoc = sinon.stub().callsArgWith(2, new Error('woops'))
				@EditorRealTimeController.emitToRoom = sinon.stub()
				@docId = 'somedoc'
				@req = {params: {project_id: @projectId, doc_id: @docId}}
				@res = {json: sinon.stub()}
				@next = sinon.stub()

			it 'should call LabelsHandler.getLabelsForDoc', () ->
				@LabelsController.getLabelsForDoc(@req, @res, @next)
				@LabelsHandler.getLabelsForDoc.callCount.should.equal 1
				@LabelsHandler.getLabelsForDoc.calledWith(@projectId).should.equal true

			it 'should call next with an error', ->
				@LabelsController.getLabelsForDoc(@req, @res, @next)
				@next.callCount.should.equal 1
				expect(@next.lastCall.args[0]).to.be.instanceof Error

			it 'should not send a json response', ->
				@LabelsController.getLabelsForDoc(@req, @res, @next)
				@res.json.callCount.should.equal 0
