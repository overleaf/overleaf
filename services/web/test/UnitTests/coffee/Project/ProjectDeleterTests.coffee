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

	describe "deleteUsersProjects", ->

		it "should remove all the projects owned by the user_id", (done)->
			user_id = 1234
			@deleter.deleteUsersProjects user_id, =>
				@Project.remove.calledWith(owner_ref:user_id).should.equal true
				done()


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

	describe "findArchivedProjects", ->
		beforeEach ->
			@projects = ["mock-project"]
			@owner_id = "mock-owner-id"
			@callback = sinon.stub()
			@Project.find = sinon.stub().callsArgWith(2, null, @projects)
			@deleter.findArchivedProjects @owner_id, @fields = "name lastModified", @callback

		it "should find the archived projects for the owner", ->
			@Project.find
				.calledWith(owner_ref: @owner_id, archived: true, @fields)
				.should.equal true

		it "should return the projects", ->
			@callback.calledWith(null, @projects).should.equal true

