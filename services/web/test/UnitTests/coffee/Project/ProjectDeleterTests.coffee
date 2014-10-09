should = require('chai').should()
modulePath = "../../../../app/js/Features/Project/ProjectDeleter"
SandboxedModule = require('sandboxed-module')
sinon = require('sinon')


describe 'Project deleter', ->

	beforeEach ->
		@project_id = "12312"
		@project = 
			_id: @project_id
			rootFolder:[]
			collaberator_refs:["collab1", "collab2"]
			readOnly_refs:["readOnly1", "readOnly2"]
			owner_ref:"owner ref here"
	
		@Project = 
			update: sinon.stub().callsArgWith(3)
			remove: sinon.stub().callsArgWith(1)
			findById: sinon.stub().callsArgWith(1, null, @project)
			applyToAllFilesRecursivly: sinon.stub()
		@documentUpdaterHandler = 
			flushProjectToMongoAndDelete:sinon.stub().callsArgWith(1)
		@editorController = notifyUsersProjectHasBeenDeletedOrRenamed : sinon.stub().callsArgWith(1)
		@TagsHandler = 
			removeProjectFromAllTags: sinon.stub().callsArgWith(2)
		@deleter = SandboxedModule.require modulePath, requires:
			"../Editor/EditorController": @editorController
			'../../models/Project':{Project:@Project}
			'../DocumentUpdater/DocumentUpdaterHandler': @documentUpdaterHandler
			"../Tags/TagsHandler":@TagsHandler
			"../FileStore/FileStoreHandler": @FileStoreHandler = {}
			'logger-sharelatex':
				log:->

	describe "mark as deleted by external source", ->
		project_id = 1234
		it 'should update the project with the flag set to true', (done)->
			@deleter.markAsDeletedByExternalSource project_id, =>
				conditions = {_id:project_id}
				update = {deletedByExternalDataSource:true}
				@Project.update.calledWith(conditions, update).should.equal true
				done()

		it 'should tell the editor controler so users are notified', (done)->
			@deleter.markAsDeletedByExternalSource project_id, =>
				@editorController.notifyUsersProjectHasBeenDeletedOrRenamed.calledWith(project_id).should.equal true
				done()
				
	describe "unmarkAsDeletedByExternalSource", ->
		beforeEach ->
			@Project.update = sinon.stub().callsArg(3)
			@callback = sinon.stub()
			@project = {
				_id: @project_id
			}
	
		describe "when the project does not have the flag set", ->
			beforeEach ->
				@project.deletedByExternalDataSource = false
				@deleter.unmarkAsDeletedByExternalSource @project, @callback
			
			it "should not update the project", ->
				@Project.update.called.should.equal false

		describe "when the project does have the flag set", ->
			beforeEach ->
				@project.deletedByExternalDataSource = true
				@deleter.unmarkAsDeletedByExternalSource @project, @callback
			
			it "should remove the flag from the project", ->
				@Project.update
					.calledWith({_id: @project_id}, {deletedByExternalDataSource:false})
					.should.equal true

	describe "deleteUsersProjects", ->

		it "should remove all the projects owned by the user_id", (done)->
			user_id = 1234
			@deleter.deleteUsersProjects user_id, =>
				@Project.remove.calledWith(owner_ref:user_id).should.equal true
				done()

	describe "deleteProject", ->
		beforeEach (done) ->
			@project_id = "mock-project-id-123"
			@deleter.archiveProject = sinon.stub().callsArg(1)

			@deleter.deleteProject @project_id, done

		it "should archive the project to clean it up", ->
			@deleter.archiveProject
				.calledWith(@project_id)
				.should.equal true

		it "should remove the project from Mongo", ->
			@Project.remove
				.calledWith(_id: @project_id)
				.should.equal true

	describe "archiveProject", ->
		beforeEach ->
			@Project.update.callsArgWith(2)

		it "should flushProjectToMongoAndDelete in doc updater", (done)->
			@deleter.archiveProject @project_id, =>
				@documentUpdaterHandler.flushProjectToMongoAndDelete.calledWith(@project_id).should.equal true
				done()

		it "should remove the project", (done)->
			@deleter.archiveProject @project_id, =>
				@Project.update.calledWith({
					_id:@project_id
				}, {
					$set: { archived: true }
				}).should.equal true
				done()

		it "should removeProjectFromAllTags", (done)->
			@deleter.archiveProject @project_id, =>
				@TagsHandler.removeProjectFromAllTags.calledWith(@project.owner_ref, @project_id).should.equal true
				@TagsHandler.removeProjectFromAllTags.calledWith(@project.collaberator_refs[0], @project_id).should.equal true
				@TagsHandler.removeProjectFromAllTags.calledWith(@project.collaberator_refs[1], @project_id).should.equal true
				@TagsHandler.removeProjectFromAllTags.calledWith(@project.readOnly_refs[0], @project_id).should.equal true
				@TagsHandler.removeProjectFromAllTags.calledWith(@project.readOnly_refs[1], @project_id).should.equal true

				done()

	describe "restoreProject", ->
		beforeEach ->
			@Project.update.callsArgWith(2)

		it "should unset the archive attribute", (done)->
			@deleter.restoreProject @project_id, =>
				@Project.update.calledWith({
					_id: @project_id
				}, {
					$unset: { archived: true }
				}).should.equal true
				done()

