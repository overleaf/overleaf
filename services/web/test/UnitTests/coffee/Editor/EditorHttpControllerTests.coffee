SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/Editor/EditorHttpController'

describe "EditorHttpController", ->
	beforeEach ->
		@EditorHttpController = SandboxedModule.require modulePath, requires:
			'../Project/ProjectEntityHandler' : @ProjectEntityHandler = {}
			'../Project/ProjectDeleter' : @ProjectDeleter = {}
			'../Project/ProjectGetter' : @ProjectGetter = {}
			'../User/UserGetter' : @UserGetter = {}
			"../Security/AuthorizationManager": @AuthorizationManager = {}
			'../Project/ProjectEditorHandler': @ProjectEditorHandler = {}
			"./EditorRealTimeController": @EditorRealTimeController = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./EditorController": @EditorController = {}
			'../../infrastructure/Metrics': @Metrics = {inc: sinon.stub()}
			
		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"
		@user_id = "mock-user-id"
		@parent_folder_id = "mock-folder-id"
		@req = {}
		@res =
			send: sinon.stub()
			sendStatus: sinon.stub()
			json: sinon.stub()
		@callback = sinon.stub()
			
	describe "joinProject", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
			@req.query =
				user_id: @user_id
			@projectView = {
				_id: @project_id
			}
			@EditorHttpController._buildJoinProjectView = sinon.stub().callsArgWith(2, null, @projectView, "owner")
			@ProjectDeleter.unmarkAsDeletedByExternalSource = sinon.stub()
			
		describe "successfully", ->
			beforeEach ->
				@EditorHttpController.joinProject @req, @res
				
			it "should get the project view", ->
				@EditorHttpController._buildJoinProjectView
					.calledWith(@project_id, @user_id)
					.should.equal true
					
			it "should return the project and privilege level", ->
				@res.json
					.calledWith({
						project: @projectView
						privilegeLevel: "owner"
					})
					.should.equal true
					
			it "should not try to unmark the project as deleted", ->
				@ProjectDeleter.unmarkAsDeletedByExternalSource 
					.called
					.should.equal false
					
			it "should send an inc metric", ->
				@Metrics.inc
					.calledWith("editor.join-project")
					.should.equal true
					
		describe "when the project is marked as deleted", ->	
			beforeEach ->
				@projectView.deletedByExternalDataSource = true
				@EditorHttpController.joinProject @req, @res
				
			it "should unmark the project as deleted", ->
				@ProjectDeleter.unmarkAsDeletedByExternalSource 
					.calledWith(@project_id)
					.should.equal true

	describe "_buildJoinProjectView", ->
		beforeEach ->
			@project =
				_id: @project_id
				owner_ref:{_id:"something"}
			@user =
				_id: @user_id = "user-id"
				projects: {}
			@projectModelView = 
				_id: @project_id
				owner:{_id:"something"}
				view: true
			@ProjectEditorHandler.buildProjectModelView = sinon.stub().returns(@projectModelView)
			@ProjectGetter.getProjectWithoutDocLines = sinon.stub().callsArgWith(1, null, @project)
			@ProjectGetter.populateProjectWithUsers = sinon.stub().callsArgWith(1, null, @project)
			@UserGetter.getUser = sinon.stub().callsArgWith(2, null, @user)
				
		describe "when authorized", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject =
					sinon.stub().callsArgWith(2, null, true, "owner")
				@EditorHttpController._buildJoinProjectView(@project_id, @user_id, @callback)
				
			it "should find the project without doc lines", ->
				@ProjectGetter.getProjectWithoutDocLines
					.calledWith(@project_id)
					.should.equal true

			it "should populate the user references in the project", ->
				@ProjectGetter.populateProjectWithUsers
					.calledWith(@project)
					.should.equal true
			
			it "should look up the user", ->
				@UserGetter.getUser
					.calledWith(@user_id, { isAdmin: true })
					.should.equal true
					
			it "should check the privilege level", ->
				@AuthorizationManager.getPrivilegeLevelForProject
					.calledWith(@project, @user)
					.should.equal true

			it "should return the project model view, privilege level and protocol version", ->
				@callback.calledWith(null, @projectModelView, "owner").should.equal true
				
		describe "when not authorized", ->
			beforeEach ->
				@AuthorizationManager.getPrivilegeLevelForProject =
					sinon.stub().callsArgWith(2, null, false, null)
				@EditorHttpController._buildJoinProjectView(@project_id, @user_id, @callback)
				
			it "should return false in the callback", ->
				@callback.calledWith(null, null, false).should.equal true

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
			@EditorController.addDoc = sinon.stub().callsArgWith(5, null, @doc)

		describe "successfully", ->
			beforeEach ->
				@EditorHttpController.addDoc @req, @res

			it "should call EditorController.addDoc", ->
				@EditorController.addDoc
					.calledWith(@project_id, @parent_folder_id, @name, [], "editor")
					.should.equal true

			it "should send the doc back as JSON", ->
				@res.json
					.calledWith(@doc)
					.should.equal true

		describe "unsuccesfully", ->
			beforeEach ->
				@req.body.name = ""
				@EditorHttpController.addDoc @req, @res

			it "should send back a bad request status code", ->
				@res.sendStatus.calledWith(400).should.equal true

	describe "addFolder", ->
		beforeEach ->
			@folder = { "mock": "folder" }
			@req.params =
				Project_id: @project_id
			@req.body =
				name: @name = "folder-name"
				parent_folder_id: @parent_folder_id
			@EditorController.addFolder = sinon.stub().callsArgWith(4, null, @folder)

		describe "successfully", ->
			beforeEach ->
				@EditorHttpController.addFolder @req, @res

			it "should call EditorController.addFolder", ->
				@EditorController.addFolder
					.calledWith(@project_id, @parent_folder_id, @name, "editor")
					.should.equal true

			it "should send the folder back as JSON", ->
				@res.json
					.calledWith(@folder)
					.should.equal true

		describe "unsuccesfully", ->

			beforeEach ->
				@req.body.name = ""
				@EditorHttpController.addFolder @req, @res

			it "should send back a bad request status code", ->
				@res.sendStatus.calledWith(400).should.equal true


	describe "renameEntity", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
				entity_id: @entity_id = "entity-id-123"
				entity_type: @entity_type = "entity-type"
			@req.body =
				name: @name = "new-name"
			@EditorController.renameEntity = sinon.stub().callsArg(4)
			@EditorHttpController.renameEntity @req, @res

		it "should call EditorController.renameEntity", ->
			@EditorController.renameEntity
				.calledWith(@project_id, @entity_id, @entity_type, @name)
				.should.equal true

		it "should send back a success response", ->
			@res.sendStatus.calledWith(204).should.equal true

	describe "renameEntity with long name", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
				entity_id: @entity_id = "entity-id-123"
				entity_type: @entity_type = "entity-type"
			@req.body =
				name: @name = "EDMUBEEBKBXUUUZERMNSXFFWIBHGSDAWGMRIQWJBXGWSBVWSIKLFPRBYSJEKMFHTRZBHVKJSRGKTBHMJRXPHORFHAKRNPZGGYIOTEDMUBEEBKBXUUUZERMNSXFFWIBHGSDAWGMRIQWJBXGWSBVWSIKLFPRBYSJEKMFHTRZBHVKJSRGKTBHMJRXPHORFHAKRNPZGGYIOT"
			@EditorController.renameEntity = sinon.stub().callsArg(4)
			@EditorHttpController.renameEntity @req, @res

		it "should send back a bad request status code", ->
			@res.sendStatus.calledWith(400).should.equal true

	describe "rename entity with 0 length name", ->

		beforeEach ->
			@req.params =
				Project_id: @project_id
				entity_id: @entity_id = "entity-id-123"
				entity_type: @entity_type = "entity-type"
			@req.body =
				name: @name = ""
			@EditorController.renameEntity = sinon.stub().callsArg(4)
			@EditorHttpController.renameEntity @req, @res

		it "should send back a bad request status code", ->
			@res.sendStatus.calledWith(400).should.equal true


	describe "moveEntity", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
				entity_id: @entity_id = "entity-id-123"
				entity_type: @entity_type = "entity-type"
			@req.body =
				folder_id: @folder_id = "folder-id-123"
			@EditorController.moveEntity = sinon.stub().callsArg(4)
			@EditorHttpController.moveEntity @req, @res

		it "should call EditorController.moveEntity", ->
			@EditorController.moveEntity
				.calledWith(@project_id, @entity_id, @folder_id, @entity_type)
				.should.equal true

		it "should send back a success response", ->
			@res.sendStatus.calledWith(204).should.equal true

	describe "deleteEntity", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
				entity_id: @entity_id = "entity-id-123"
				entity_type: @entity_type = "entity-type"
			@EditorController.deleteEntity = sinon.stub().callsArg(4)
			@EditorHttpController.deleteEntity @req, @res

		it "should call EditorController.deleteEntity", ->
			@EditorController.deleteEntity
				.calledWith(@project_id, @entity_id, @entity_type, "editor")
				.should.equal true

		it "should send back a success response", ->
			@res.sendStatus.calledWith(204).should.equal true
