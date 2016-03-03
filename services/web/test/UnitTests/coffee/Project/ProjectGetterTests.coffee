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

	describe "getProjectWithoutDocLines", ->
		beforeEach ->
			@project =
				_id: @project_id = "0123456789abcd9876543210"
			@db.projects.find = sinon.stub().callsArgWith(2, null, [@project])
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
		beforeEach ->
			@project =
				_id: @project_id = "0123456789abcd9876543210"
			@db.projects.find = sinon.stub().callsArgWith(2, null, [@project])
			@ProjectGetter.getProjectWithOnlyFolders @project_id, @callback

		it "should call find with the project id", ->
			@db.projects.find.calledWith(_id: ObjectId(@project_id)).should.equal true

		it "should exclude the docs and files lines", ->
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
			@db.projects.find.calledWith(sinon.match.any, excludes)
				.should.equal true

		it "should call the callback with the project", ->
			@callback.calledWith(null, @project).should.equal true


	describe "populateProjectWithUsers", ->
		beforeEach ->
			@users = []
			@user_lookup = {}
			for i in [0..4]
				@users[i] = _id: ObjectId.createPk()
				@user_lookup[@users[i]._id.toString()] = @users[i]
			@project =
				_id: ObjectId.createPk()
				owner_ref: @users[0]._id
				readOnly_refs: [@users[1]._id, @users[2]._id]
				collaberator_refs: [@users[3]._id, @users[4]._id]
			@db.users.find = (query, callback) =>
				callback null, [@user_lookup[query._id.toString()]]
			sinon.spy @db.users, "find"
			@ProjectGetter.populateProjectWithUsers @project, (err, project)=>
				@callback err, project

		it "should look up each user", ->
			for user in @users
				@db.users.find.calledWith(_id: user._id).should.equal true

		it "should set the owner_ref to the owner", ->
			@project.owner_ref.should.equal @users[0]

		it "should set the readOnly_refs to the read only users", ->
			expect(@project.readOnly_refs).to.deep.equal [@users[1], @users[2]]

		it "should set the collaberator_refs to the collaborators", ->
			expect(@project.collaberator_refs).to.deep.equal [@users[3], @users[4]]

		it "should call the callback", ->
			assert.deepEqual @callback.args[0][1], @project
			
	describe "findAllUsersProjects", ->
		beforeEach ->
			@fields = {"mock": "fields"}
			@Project.find = sinon.stub()
			@Project.find.withArgs({owner_ref: @user_id}, @fields).yields(null, ["mock-owned-projects"])
			@CollaboratorsHandler.getProjectsUserIsMemberOf = sinon.stub()
			@CollaboratorsHandler.getProjectsUserIsMemberOf.withArgs(@user_id, @fields).yields(null, ["mock-rw-projects"], ["mock-ro-projects"])
			@ProjectGetter.findAllUsersProjects @user_id, @fields, @callback
		
		it "should call the callback with all the projects", ->
			@callback
				.calledWith(null, ["mock-owned-projects"], ["mock-rw-projects"], ["mock-ro-projects"])
				.should.equal true
