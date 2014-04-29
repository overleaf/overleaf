SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/MongoManager'
ObjectId = require("mongojs").ObjectId

describe "MongoManager", ->
	beforeEach ->
		@MongoManager = SandboxedModule.require modulePath, requires:
			"./mongojs":
				db: @db = { projects: {}, docs: {} }
				ObjectId: ObjectId
		@project_id = ObjectId().toString()
		@callback = sinon.stub()

	describe "findProject", ->
		beforeEach ->
			@project = { name: "mock-project" }
			@db.projects.find = sinon.stub().callsArgWith(2, null, [@project])
			@MongoManager.findProject @project_id, @callback

		it "should find the project without the doc lines", ->
			@db.projects.find
				.calledWith({
					_id: ObjectId(@project_id)
				}, {})
				.should.equal true

		it "should call the callback with the project", ->
			@callback.calledWith(null, @project).should.equal true

	describe "updateDoc", ->
		beforeEach ->
			@lines = ["mock-lines"]
			@docPath = "rootFolder.0.folders.1.docs.0"
			@db.projects.update = sinon.stub().callsArg(2)
			@MongoManager.updateDoc @project_id, @docPath, @lines, @callback

		it "should update the doc lines and increment the TPDS rev", ->
			@db.projects.update
				.calledWith({
					_id: ObjectId(@project_id)
				}, {
					$set:
						"rootFolder.0.folders.1.docs.0.lines": @lines
					$inc:
						"rootFolder.0.folders.1.docs.0.rev": 1
				})
				.should.equal true

		it "should call the callback with the project", ->
			@callback.called.should.equal true

	describe "insertDoc", ->
		beforeEach ->
			@doc_id = ObjectId().toString()
			@lines = ["mock-lines"]
			@db.docs.insert = sinon.stub().callsArg(1)
			@MongoManager.insertDoc @project_id, @doc_id, lines: @lines, @callback

		it "should insert the attributes with the given doc and project id", ->
			@db.docs.insert
				.calledWith({
					_id: ObjectId(@doc_id)
					project_id: ObjectId(@project_id)
					lines: @lines
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true