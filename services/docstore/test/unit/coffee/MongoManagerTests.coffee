SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/MongoManager'
ObjectId = require("mongojs").ObjectId
assert = require("chai").assert

describe "MongoManager", ->
	beforeEach ->
		@MongoManager = SandboxedModule.require modulePath, requires:
			"./mongojs":
				db: @db = { projects: {}, docs: {} }
				ObjectId: ObjectId
		@project_id = ObjectId().toString()
		@doc_id = ObjectId().toString()
		@callback = sinon.stub()
		@stubbedErr = new Error("hello world")

	describe "findProject", ->
		beforeEach ->
			@project = { name: "mock-project" }
			@db.projects.find = sinon.stub().callsArgWith(2, null, [@project])
			@MongoManager.findProject @project_id, @callback

		it "should find the project", ->
			@db.projects.find
				.calledWith({
					_id: ObjectId(@project_id)
				}, {})
				.should.equal true

		it "should call the callback with the project", ->
			@callback.calledWith(null, @project).should.equal true

	describe "findDoc", ->
		beforeEach ->
			@doc = { name: "mock-doc" }
			@db.docs.find = sinon.stub().callsArgWith(2, null, [@doc])
			@MongoManager.findDoc @doc_id, @callback

		it "should find the doc", ->
			@db.docs.find
				.calledWith({
					_id: ObjectId(@doc_id)
				}, {})
				.should.equal true

		it "should call the callback with the doc", ->
			@callback.calledWith(null, @doc).should.equal true

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


	describe "upsertIntoDocCollection", ->
		beforeEach ->
			@db.docs.update = sinon.stub().callsArgWith(3, @stubbedErr)
			@oldRev = 77

		it "should upsert the document", (done)->	
			@MongoManager.upsertIntoDocCollection @project_id, @doc_id, @lines, @oldRev, (err)=>
				args = @db.docs.update.args[0]
				assert.deepEqual args[0], {_id: ObjectId(@doc_id)}
				assert.equal args[1]["$set"]["lines"], @lines
				assert.equal args[1]["$set"]["rev"], 78
				assert.deepEqual args[1]["$set"]["project_id"], ObjectId(@project_id)
				done()

		it "should return the error", (done)->
			@MongoManager.upsertIntoDocCollection @project_id, @doc_id, @lines, @oldRev, (err)=>
				err.should.equal @stubbedErr
				done()

	describe "markDocAsDeleted", ->
		beforeEach ->
			@db.docs.update = sinon.stub().callsArgWith(2, @stubbedErr)
			@oldRev = 77

		it "should process the update", (done)->	
			@MongoManager.markDocAsDeleted @doc_id, (err)=>
				args = @db.docs.update.args[0]
				assert.deepEqual args[0], {_id: ObjectId(@doc_id)}
				assert.equal args[1]["$set"]["deleted"], true
				done()

		it "should return the error", (done)->
			@MongoManager.markDocAsDeleted @doc_id, (err)=>
				err.should.equal @stubbedErr
				done()

	