should = require('chai').should()
modulePath = "../../../../app/js/Features/Project/ProjectDeleter"
SandboxedModule = require('sandboxed-module')
sinon = require('sinon')

describe 'ProjectDeleter', ->

	beforeEach ->
		@project_id = "12312"
		@project = 
			_id: @project_id
			rootFolder:[]
			collaberator_refs:["collab1", "collab2"]
			readOnly_refs:["readOnly1", "readOnly2"]
			owner_ref:"owner ref here"
			remove: sinon.stub().callsArg(0)

		@user =
			_id:"588f3ddae8ebc1bac07c9fa4"
			first_name: "bjkdsjfk"
			features: {}
	
		@Project = 
			update: sinon.stub().callsArgWith(3)
			remove: sinon.stub().callsArgWith(1)
			findOne: sinon.stub().callsArgWith(1, null, @project)
			find: sinon.stub().callsArgWith(1, null, [@project])
			applyToAllFilesRecursivly: sinon.stub()
		@DeletedProject = class DeletedProject
			constructor: ->
			save: sinon.stub().callsArgWith(0)
		@documentUpdaterHandler = 
			flushProjectToMongoAndDelete:sinon.stub().callsArgWith(1)
		@editorController = notifyUsersProjectHasBeenDeletedOrRenamed : sinon.stub().callsArgWith(1)
		@TagsHandler = 
			removeProjectFromAllTags: sinon.stub().callsArgWith(2)
		@CollaboratorsHandler =
			removeUserFromAllProjets: sinon.stub().yields()
			getMemberIds: sinon.stub().withArgs(@project_id).yields(null, ["member-id-1", "member-id-2"])
		@deleter = SandboxedModule.require modulePath, requires:
			"../Editor/EditorController": @editorController
			'../../models/Project':{Project:@Project}
			'../../models/DeletedProject':{DeletedProject:@DeletedProject}
			'../DocumentUpdater/DocumentUpdaterHandler': @documentUpdaterHandler
			"../Tags/TagsHandler":@TagsHandler
			"../FileStore/FileStoreHandler": @FileStoreHandler = {}
			"../Collaborators/CollaboratorsHandler": @CollaboratorsHandler
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
			@deleter.unmarkAsDeletedByExternalSource @project_id, @callback
		
		it "should remove the flag from the project", ->
			@Project.update
				.calledWith({_id: @project_id}, {deletedByExternalDataSource:false})
				.should.equal true

	describe "deleteUsersProjects", ->
		beforeEach ->
			@deleter.deleteProject = sinon.stub().callsArg(1)

		it "should find all the projects owned by the user_id", (done)->
			@deleter.deleteUsersProjects @user._id, =>
				sinon.assert.calledWith(@Project.find, owner_ref: @user._id)
				done()

		it "should call deleteProject on the found projects", (done)->
			@deleter.deleteUsersProjects @user._id, =>
				sinon.assert.calledWith(@deleter.deleteProject, @project._id)
				done()

		it "should call deleteProject once for each project", (done)->
			@Project.find.callsArgWith(1, null, [
				{_id: 'potato'}, {_id: 'wombat'}
			])
			@deleter.deleteUsersProjects @user._id, =>
				sinon.assert.calledTwice(@deleter.deleteProject)
				sinon.assert.calledWith(@deleter.deleteProject, 'wombat')
				sinon.assert.calledWith(@deleter.deleteProject, 'potato')
				done()

		it "should remove all the projects the user is a collaborator of", (done)->
			@deleter.deleteUsersProjects @user._id, =>
				@CollaboratorsHandler.removeUserFromAllProjets.calledWith(@user._id).should.equal true
				done()

	describe "deleteProject", ->
		beforeEach () ->
			@project_id = "mock-project-id-123"
			@ip = "192.170.18.1"

		it "should save a DeletedProject with additional deleterData", (done) ->
			@deleter.deleteProject @project_id, {deleterUser: @user, ipAddress: @ip}, (err, deletedProject) =>
				@DeletedProject::save.called.should.equal true
				deletedProject.deleterData.deleterIpAddress.should.equal(@ip)
				deletedProject.deleterData.deleterId.should.equal(@user._id)
				done()

		it "should flushProjectToMongoAndDelete in doc updater", (done)->
			@deleter.deleteProject @project_id, {deleterUser: @user, ipAddress: @ip}, =>
				@documentUpdaterHandler.flushProjectToMongoAndDelete.calledWith(@project_id).should.equal true
				done()

		it "should removeProjectFromAllTags", (done)->
			@deleter.deleteProject @project_id, =>
				@TagsHandler.removeProjectFromAllTags.calledWith("member-id-1", @project_id).should.equal true
				@TagsHandler.removeProjectFromAllTags.calledWith("member-id-2", @project_id).should.equal true
				done()

		it "should remove the project from Mongo", (done) ->
			@deleter.deleteProject @project_id, =>
				@Project.remove.calledWith({
					_id: @project_id
				}).should.equal true
				done()

	describe "archiveProject", ->
		beforeEach ->
			@Project.update.callsArgWith(2)

		it "should update the project", (done)->
			@deleter.archiveProject @project_id, =>
				@Project.update.calledWith({
					_id:@project_id
				}, {
					$set: { archived: true }
				}).should.equal true
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

