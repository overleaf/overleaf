SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/Editor/EditorHttpController'

describe "EditorHttpController", ->
	beforeEach ->
		@EditorHttpController = SandboxedModule.require modulePath, requires:
			'../Project/ProjectEntityHandler' : @ProjectEntityHandler = {}
			"./EditorRealTimeController": @EditorRealTimeController = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./EditorController": @EditorController = {}
		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"
		@parent_folder_id = "mock-folder-id"
		@req = {}
		@res =
			send: sinon.stub()
			json: sinon.stub()

	describe "restoreDoc", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
				doc_id: @doc_id
			@req.body =
				name: @name = "doc-name"
			@ProjectEntityHandler.restoreDoc = sinon.stub().callsArgWith(3, null,
				@doc = { "mock": "doc", _id: @new_doc_id = "new-doc-id" }
				@folder_id = "mock-folder-id"
			)
			@EditorRealTimeController.emitToRoom = sinon.stub()
			@EditorHttpController.restoreDoc @req, @res

		it "should restore the doc", ->
			@ProjectEntityHandler.restoreDoc
				.calledWith(@project_id, @doc_id, @name)
				.should.equal true

		it "should the real-time clients about the new doc", ->
			@EditorRealTimeController.emitToRoom
				.calledWith(@project_id, 'reciveNewDoc', @folder_id, @doc)
				.should.equal true

		it "should return the new doc id", ->
			@res.json
				.calledWith(doc_id: @new_doc_id)
				.should.equal true

	describe "addDoc", ->
		beforeEach ->
			@doc = { "mock": "doc" }
			@req.params =
				Project_id: @project_id
			@req.body =
				name: @name = "doc-name"
				parent_folder_id: @parent_folder_id
			@EditorController.addDoc = sinon.stub().callsArgWith(4, null, @doc)
			@EditorHttpController.addDoc @req, @res

		it "should call EditorController.addDoc", ->
			@EditorController.addDoc
				.calledWith(@project_id, @parent_folder_id, @name, [])
				.should.equal true

		it "should send the doc back as JSON", ->
			@res.json
				.calledWith(@doc)
				.should.equal true

