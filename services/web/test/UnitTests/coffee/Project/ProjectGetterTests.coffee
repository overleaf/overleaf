sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Project/ProjectGetter.js"
SandboxedModule = require('sandboxed-module')
ObjectId = require("mongojs").ObjectId
assert = require("chai").assert

describe "ProjectGetter", ->
	beforeEach ->
		@callback = sinon.stub()
		@ProjectGetter = SandboxedModule.require modulePath, requires:
			"../../infrastructure/mongojs":
				db: @db =
					projects: {}
					users: {}
				ObjectId: ObjectId
			"../../models/Project": Project: @Project = {}
			"../Collaborators/CollaboratorsHandler": @CollaboratorsHandler = {}
			"logger-sharelatex":
				err:->
				log:->

	describe "getProjectWithoutDocLines", ->
		beforeEach ->
			@project =
				_id: @project_id = "56d46b0a1d3422b87c5ebcb1"
			@db.projects.find = sinon.stub().callsArgWith(2, null, [@project])

		describe "passing an id", ->
			beforeEach ->
				@ProjectGetter.getProjectWithoutDocLines @project_id, @callback

			it "should call find with the project id", ->
				@db.projects.find.calledWith(_id: ObjectId(@project_id)).should.equal true

			it "should exclude the doc lines", ->
				excludes =
					"rootFolder.docs.lines": 0
					"rootFolder.folder.docs.lines": 0
					"rootFolder.folder.folder.docs.lines": 0
					"rootFolder.folder.folder.folder.docs.lines": 0
					"rootFolder.folder.folder.folder.folder.docs.lines": 0
					"rootFolder.folder.folder.folder.folder.folder.docs.lines": 0
					"rootFolder.folder.folder.folder.folder.folder.folder.docs.lines": 0
					"rootFolder.folder.folder.folder.folder.folder.folder.folder.docs.lines": 0
				@db.projects.find.calledWith(sinon.match.any, excludes)
					.should.equal true

			it "should call the callback with the project", ->
				@callback.calledWith(null, @project).should.equal true


	describe "getProjectWithOnlyFolders", ->

		beforeEach ()->
			@project =
				_id: @project_id = "56d46b0a1d3422b87c5ebcb1"
			@db.projects.find = sinon.stub().callsArgWith(2, null, [@project])
	
		describe "passing an id", ->
			beforeEach ->
				@ProjectGetter.getProjectWithOnlyFolders @project_id, @callback

			it "should call find with the project id", ->
				@db.projects.find.calledWith(_id: ObjectId(@project_id)).should.equal true

			it "should exclude the docs and files linesaaaa", ->
				excludes =
					"rootFolder.docs": 0
					"rootFolder.fileRefs": 0
					"rootFolder.folder.docs": 0
					"rootFolder.folder.fileRefs": 0
					"rootFolder.folder.folder.docs": 0
					"rootFolder.folder.folder.fileRefs": 0
					"rootFolder.folder.folder.folder.docs": 0
					"rootFolder.folder.folder.folder.fileRefs": 0
					"rootFolder.folder.folder.folder.folder.docs": 0
					"rootFolder.folder.folder.folder.folder.fileRefs": 0
					"rootFolder.folder.folder.folder.folder.folder.docs": 0
					"rootFolder.folder.folder.folder.folder.folder.fileRefs": 0
					"rootFolder.folder.folder.folder.folder.folder.folder.docs": 0
					"rootFolder.folder.folder.folder.folder.folder.folder.fileRefs": 0
					"rootFolder.folder.folder.folder.folder.folder.folder.folder.docs": 0
					"rootFolder.folder.folder.folder.folder.folder.folder.folder.fileRefs": 0
				@db.projects.find.calledWith(sinon.match.any, excludes).should.equal true

			it "should call the callback with the project", ->
				@callback.calledWith(null, @project).should.equal true



	describe "getProject", ->
		beforeEach ()->
			@project =
				_id: @project_id = "56d46b0a1d3422b87c5ebcb1"
			@db.projects.find = sinon.stub().callsArgWith(2, null, [@project])
	
		describe "passing an id", ->
			beforeEach ->
				@ProjectGetter.getProjectWithOnlyFolders @project_id, @callback

			it "should call find with the project id", ->
				@db.projects.find.calledWith(_id: ObjectId(@project_id)).should.equal true

			it "should exclude the docs and files linesaaaa", ->
				excludes =
					"rootFolder.docs": 0
					"rootFolder.fileRefs": 0
					"rootFolder.folder.docs": 0
					"rootFolder.folder.fileRefs": 0
					"rootFolder.folder.folder.docs": 0
					"rootFolder.folder.folder.fileRefs": 0
					"rootFolder.folder.folder.folder.docs": 0
					"rootFolder.folder.folder.folder.fileRefs": 0
					"rootFolder.folder.folder.folder.folder.docs": 0
					"rootFolder.folder.folder.folder.folder.fileRefs": 0
					"rootFolder.folder.folder.folder.folder.folder.docs": 0
					"rootFolder.folder.folder.folder.folder.folder.fileRefs": 0
					"rootFolder.folder.folder.folder.folder.folder.folder.docs": 0
					"rootFolder.folder.folder.folder.folder.folder.folder.fileRefs": 0
					"rootFolder.folder.folder.folder.folder.folder.folder.folder.docs": 0
					"rootFolder.folder.folder.folder.folder.folder.folder.folder.fileRefs": 0
				@db.projects.find.calledWith(sinon.match.any, excludes).should.equal true

			it "should call the callback with the project", ->
				@callback.calledWith(null, @project).should.equal true



	describe "getProject", ->
		beforeEach ()->
			@project =
				_id: @project_id = "56d46b0a1d3422b87c5ebcb1"
			@db.projects.find = sinon.stub().callsArgWith(2, null, [@project])


	describe "findAllUsersProjects", ->
		beforeEach ->
			@fields = {"mock": "fields"}
			@Project.find = sinon.stub()
			@Project.find.withArgs({owner_ref: @user_id}, @fields).yields(null, ["mock-owned-projects"])
			@CollaboratorsHandler.getProjectsUserIsCollaboratorOf = sinon.stub()
			@CollaboratorsHandler.getProjectsUserIsCollaboratorOf.withArgs(@user_id, @fields).yields(null, ["mock-rw-projects"], ["mock-ro-projects"])
			@ProjectGetter.findAllUsersProjects @user_id, @fields, @callback
		
		it "should call the callback with all the projects", ->
			@callback
				.calledWith(null, ["mock-owned-projects"], ["mock-rw-projects"], ["mock-ro-projects"])
				.should.equal true
