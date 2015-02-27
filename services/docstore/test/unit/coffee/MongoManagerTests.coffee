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
				db: @db = { docs: {} }
				ObjectId: ObjectId
		@project_id = ObjectId().toString()
		@doc_id = ObjectId().toString()
		@callback = sinon.stub()
		@stubbedErr = new Error("hello world")

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

	describe "getProjectsDocs", ->
		beforeEach ->
			@doc1 = { name: "mock-doc1" }
			@doc2 = { name: "mock-doc2" }
			@doc3 = { name: "mock-doc3" }
			@doc4 = { name: "mock-doc4" }
			@db.docs.find = sinon.stub().callsArgWith(2, null, [@doc, @doc3, @doc4])
			@MongoManager.getProjectsDocs @project_id, @callback

		it "should find the docs via the project_id", ->
			@db.docs.find
				.calledWith({
					project_id: ObjectId(@project_id)
				}, {})
				.should.equal true

		it "should call the callback with the docs", ->
			@callback.calledWith(null, [@doc, @doc3, @doc4]).should.equal true

	describe "upsertIntoDocCollection", ->
		beforeEach ->
			@db.docs.update = sinon.stub().callsArgWith(3, @stubbedErr)
			@oldRev = 77

		it "should upsert the document", (done)->	
			@MongoManager.upsertIntoDocCollection @project_id, @doc_id, @lines, (err)=>
				args = @db.docs.update.args[0]
				assert.deepEqual args[0], {_id: ObjectId(@doc_id)}
				assert.equal args[1]["$set"]["lines"], @lines
				assert.equal args[1]["$inc"]["rev"], 1
				assert.deepEqual args[1]["$set"]["project_id"], ObjectId(@project_id)
				done()

		it "should return the error", (done)->
			@MongoManager.upsertIntoDocCollection @project_id, @doc_id, @lines, (err)=>
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

	