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
				db: @db = { docs: {}, docOps: {} }
				ObjectId: ObjectId
		@project_id = ObjectId().toString()
		@doc_id = ObjectId().toString()
		@callback = sinon.stub()
		@stubbedErr = new Error("hello world")

	describe "findDoc", ->
		beforeEach ->
			@doc = { name: "mock-doc"}
			@db.docs.find = sinon.stub().callsArgWith(2, null, [@doc])
			@MongoManager.findDoc @project_id, @doc_id, @callback

		it "should find the doc", ->
			@db.docs.find
				.calledWith({
					_id: ObjectId(@doc_id)
					project_id: ObjectId(@project_id)
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
		
		describe "with included_deleted = false", ->
			beforeEach -> 
				@MongoManager.getProjectsDocs @project_id, include_deleted: false, @callback

			it "should find the non-deleted docs via the project_id", ->
				@db.docs.find
					.calledWith({
						project_id: ObjectId(@project_id)
						deleted: { $ne: true }
					}, {})
					.should.equal true

			it "should call the callback with the docs", ->
				@callback.calledWith(null, [@doc, @doc3, @doc4]).should.equal true
				
		describe "with included_deleted = true", ->
			beforeEach -> 
				@MongoManager.getProjectsDocs @project_id, include_deleted: true, @callback

			it "should find all via the project_id", ->
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

	describe "getDocVersion", ->
		describe "when the doc exists", ->
			beforeEach ->
				@doc =
					version: @version = 42
				@db.docOps.find = sinon.stub().callsArgWith(2, null, [@doc])
				@MongoManager.getDocVersion @doc_id, @callback

			it "should look for the doc in the database", ->
				@db.docOps.find
					.calledWith({ doc_id: ObjectId(@doc_id) }, {version: 1})
					.should.equal true

			it "should call the callback with the version", ->
				@callback.calledWith(null, @version).should.equal true

		describe "when the doc doesn't exist", ->
			beforeEach ->
				@db.docOps.find = sinon.stub().callsArgWith(2, null, [])
				@MongoManager.getDocVersion @doc_id, @callback

			it "should call the callback with 0", ->
				@callback.calledWith(null, 0).should.equal true

	describe "setDocVersion", ->
		beforeEach ->
			@version = 42
			@db.docOps.update = sinon.stub().callsArg(3)
			@MongoManager.setDocVersion @doc_id, @version, @callback

		it "should update the doc version", ->
			@db.docOps.update
				.calledWith({
					doc_id: ObjectId(@doc_id)
				}, {
					$set:
						version: @version
				}, {
					upsert: true 
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true