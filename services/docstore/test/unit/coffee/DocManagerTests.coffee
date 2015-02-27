SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
chai = require('chai')
chai.should()
expect = chai.expect
modulePath = require('path').join __dirname, '../../../app/js/DocManager'
ObjectId = require("mongojs").ObjectId
Errors = require "../../../app/js/Errors"

describe "DocManager", ->
	beforeEach ->
		@DocManager = SandboxedModule.require modulePath, requires:
			"./MongoManager": @MongoManager = {}
			"logger-sharelatex": @logger = 
				log: sinon.stub()
				warn:->
				err:->
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()
		@callback = sinon.stub()
		@stubbedError = new Error("blew up")

	describe "getDoc", ->
		beforeEach ->
			@project = { name: "mock-project" }
			@doc = { _id: @doc_id, lines: ["mock-lines"] }
			@docCollectionDoc = { _id: @doc_id, lines: ["mock-lines"] }

		describe "when the doc is in the doc collection not projects collection", ->

			beforeEach ->
				@MongoManager.findDoc = sinon.stub()

			it "should get the doc from the doc collection when it is present there", (done)->
				@MongoManager.findDoc.callsArgWith(1, null, @docCollectionDoc)
				@DocManager.getDoc @project_id, @doc_id, (err, doc)=>
					doc.should.equal @docCollectionDoc
					done()

			it "should return the error from find doc", (done)->
				@MongoManager.findDoc.callsArgWith(1, @stubbedError)
				@DocManager.getDoc @project_id, @doc_id, (err, doc)=>
					err.should.equal @stubbedError
					done()

		describe "when the doc is deleted", ->
			beforeEach -> 
				@MongoManager.findDoc = sinon.stub().callsArgWith(1, null, @doc)

				@DocManager.getDoc @project_id, @doc_id, @callback

				it "should try to find the doc in the docs collection", ->
					@MongoManager.findDoc
						.calledWith(@doc_id)
						.should.equal true

				it "should return the doc", ->
					@callback
						.calledWith(null, @doc)
						.should.equal true

		describe "when the doc does not exist anywhere", ->
			beforeEach -> 
				@MongoManager.findDoc = sinon.stub().callsArgWith(1, null, null)
				@DocManager.getDoc @project_id, @doc_id, @callback

			it "should return a NotFoundError", ->
				@callback
					.calledWith(new Errors.NotFoundError("No such doc: #{@doc_id} in project #{@project_id}"))
					.should.equal true

	describe "getAllDocs", ->
		describe "when the project exists", ->
			beforeEach -> 
				@docs = [{ _id: @doc_id, lines: ["mock-lines"] }]
				@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(1, null, @docs)
				@DocManager.getAllDocs @project_id, @callback

			it "should get the project from the database", ->
				@MongoManager.getProjectsDocs
					.calledWith(@project_id)
					.should.equal true

			it "should return the docs", ->
				@callback.calledWith(null, @docs).should.equal true

		describe "when there are no docs for the project", ->
			beforeEach -> 
				@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(1, null, null)
				@DocManager.getAllDocs @project_id, @callback

			it "should return a NotFoundError", ->
				@callback
					.calledWith(new Errors.NotFoundError("No such docs for project #{@project_id}"))
					.should.equal true

	describe "deleteDoc", ->
		describe "when the doc exists", ->
			beforeEach ->
				@lines = ["mock", "doc", "lines"]
				@rev = 77
				@DocManager.getDoc = sinon.stub().callsArgWith(2, null, {lines: @lines, rev:@rev})
				@MongoManager.upsertIntoDocCollection = sinon.stub().callsArg(3)
				@MongoManager.markDocAsDeleted = sinon.stub().callsArg(1)
				@DocManager.deleteDoc @project_id, @doc_id, @callback

			it "should get the doc", ->
				@DocManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should update the doc lines", ->
				@MongoManager.upsertIntoDocCollection
					.calledWith(@project_id, @doc_id, @lines)
					.should.equal true

			it "should mark doc as deleted", ->
				@MongoManager.markDocAsDeleted
					.calledWith(@doc_id)
					.should.equal true

			it "should return the callback", ->
				@callback.called.should.equal true

		describe "when the doc does not exist", ->
			beforeEach -> 
				@DocManager.getDoc = sinon.stub().callsArgWith(2, null, null)
				@MongoManager.upsertIntoDocCollection = sinon.stub()
				@DocManager.deleteDoc @project_id, @doc_id, @callback

			it "should not try to insert a deleted doc", ->
				@MongoManager.upsertIntoDocCollection.called.should.equal false

			it "should return a NotFoundError", ->
				@callback
					.calledWith(new Errors.NotFoundError("No such doc: #{@doc_id}"))
					.should.equal true

	describe "updateDoc", ->
		beforeEach ->
			@oldDocLines = ["old", "doc", "lines"]
			@newDocLines = ["new", "doc", "lines"]
			@doc = { _id: @doc_id, lines: @oldDocLines, rev: @rev = 5 }

			@MongoManager.upsertIntoDocCollection = sinon.stub().callsArg(3)
			@MongoManager.findDoc = sinon.stub()

		describe "when the doc lines have changed", ->
			beforeEach ->
				@MongoManager.findDoc = sinon.stub().callsArgWith(1, null, @doc)
				@DocManager.updateDoc @project_id, @doc_id, @newDocLines, @callback

			it "should get the existing doc", ->
				@MongoManager.findDoc
					.calledWith(@doc_id)
					.should.equal true

			it "should upsert the document to the doc collection", ->
				@MongoManager.upsertIntoDocCollection
					.calledWith(@project_id, @doc_id, @newDocLines)
					.should.equal true				

			it "should log out the old and new doc lines", ->
				@logger.log
					.calledWith(
						project_id: @project_id
						doc_id: @doc_id
						oldDocLines: @oldDocLines
						newDocLines: @newDocLines
						rev: @doc.rev
						"updating doc lines"
					)
					.should.equal true

			it "should return the callback with the new rev", ->
				@callback.calledWith(null, true, @rev + 1).should.equal true

		describe "when there is a generic error getting the doc", ->

			beforeEach ->
				@error =  new Error("doc could not be found")
				@MongoManager.findDoc = sinon.stub().callsArgWith(1, @error, null, null)
				@DocManager.updateDoc @project_id, @doc_id, @newDocLines, @callback
			
			it "should not upsert the document to the doc collection", ->
				@MongoManager.upsertIntoDocCollection.called.should.equal false

			it "should return the callback with the error", ->
				@callback.calledWith(@error).should.equal true

		describe "when the doc lines have not changed", ->
			beforeEach ->
				@MongoManager.findDoc = sinon.stub().callsArgWith(1, null, @doc)
				@DocManager.updateDoc @project_id, @doc_id, @oldDocLines.slice(), @callback

			it "should not update the doc", ->
				@MongoManager.upsertIntoDocCollection.called.should.equal false

			it "should return the callback with the existing rev", ->
				@callback.calledWith(null, false, @rev).should.equal true


		describe "when the doc lines are an empty array", ->
			beforeEach ->

				@doc.lines = []
				@MongoManager.findDoc = sinon.stub().callsArgWith(1, null, @doc)
				@DocManager.updateDoc @project_id, @doc_id, @doc.lines, @callback

			it "should upsert the document to the doc collection", ->
				@MongoManager.upsertIntoDocCollection
					.calledWith(@project_id, @doc_id,  @doc.lines)
					.should.equal true	


		describe "when the doc does not exist", ->
			beforeEach ->
				@MongoManager.findDoc = sinon.stub().callsArgWith(1, null, null, null)
				@DocManager.updateDoc @project_id, @doc_id, @newDocLines, @callback
			
			it "should upsert the document to the doc collection", ->
				@MongoManager.upsertIntoDocCollection
					.calledWith(@project_id, @doc_id, @newDocLines)
					.should.equal true				

			it "should return the callback with the new rev", ->
				@callback.calledWith(null, true, 1).should.equal true



