SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
chai = require('chai')
assert = require("chai").assert
chai.should()
expect = chai.expect
modulePath = require('path').join __dirname, '../../../app/js/DocManager'
ObjectId = require("mongojs").ObjectId
Errors = require "../../../app/js/Errors"

describe "DocManager", ->
	beforeEach ->
		@DocManager = SandboxedModule.require modulePath, requires:
			"./MongoManager": @MongoManager = {}
			"./DocArchiveManager": @DocArchiveManager = {}
			"./RangeManager": @RangeManager = {
				jsonRangesToMongo: (r) -> r
				shouldUpdateRanges: sinon.stub().returns false
			}
			"logger-sharelatex": @logger = 
				log: sinon.stub()
				warn:->
				err:->
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()
		@another_project_id = ObjectId().toString()
		@callback = sinon.stub()
		@stubbedError = new Error("blew up")


	describe "checkDocExists", ->
		beforeEach ->
			@DocManager._getDoc = sinon.stub()

		it "should call get doc with a quick filter", (done)->
			@DocManager._getDoc.callsArgWith(3, null, {_id:@doc_id})
			@DocManager.checkDocExists @project_id, @doc_id, (err, exist)=>
				exist.should.equal true
				@DocManager._getDoc.calledWith(@project_id, @doc_id, {_id:1, inS3:true}).should.equal true
				done()

		it "should return false when doc is not there", (done)->
			@DocManager._getDoc.callsArgWith(3, null)
			@DocManager.checkDocExists @project_id, @doc_id, (err, exist)=>
				exist.should.equal false
				done()

		it "should return error when get doc errors", (done)->
			@DocManager._getDoc.callsArgWith(3, "error")
			@DocManager.checkDocExists @project_id, @doc_id, (err, exist)=>
				err.should.equal "error"
				done()

	describe "getFullDoc", ->
		beforeEach ->
			@DocManager._getDoc = sinon.stub()
			@doc = 
				_id: @doc_id
				lines:["2134"]

		it "should call get doc with a quick filter", (done)->
			@DocManager._getDoc.callsArgWith(3, null, @doc)
			@DocManager.getFullDoc @project_id, @doc_id, (err, doc)=>
				doc.should.equal @doc
				@DocManager._getDoc.calledWith(@project_id, @doc_id, {lines: true, rev: true, deleted: true, version: true, ranges: true, inS3:true}).should.equal true
				done()
	
		it "should return error when get doc errors", (done)->
			@DocManager._getDoc.callsArgWith(3, "error")
			@DocManager.getFullDoc @project_id, @doc_id, (err, exist)=>
				err.should.equal "error"
				done()

	describe "getRawDoc", ->

		beforeEach ->
			@DocManager._getDoc = sinon.stub()
			@doc = 
				lines:["2134"]

		it "should call get doc with a quick filter", (done)->
			@DocManager._getDoc.callsArgWith(3, null, @doc)
			@DocManager.getDocLines @project_id, @doc_id, (err, doc)=>
				doc.should.equal @doc
				@DocManager._getDoc.calledWith(@project_id, @doc_id, {lines: true, inS3:true}).should.equal true
				done()
	
		it "should return error when get doc errors", (done)->
			@DocManager._getDoc.callsArgWith(3, "error")
			@DocManager.getDocLines @project_id, @doc_id, (err, exist)=>
				err.should.equal "error"
				done()



	describe "getDoc", ->
		beforeEach ->
			@project = { name: "mock-project" }
			@doc = { _id: @doc_id, project_id: @project_id, lines: ["mock-lines"] }
			@version = 42
			@MongoManager.findDoc = sinon.stub()
			@MongoManager.getDocVersion = sinon.stub().yields(null, @version)

		describe "when using a filter", ->
			beforeEach ->
				@MongoManager.findDoc.yields(null, @doc)

			it "should error if inS3 is not set to true", (done)->
				@DocManager._getDoc @project_id, @doc_id, {inS3: false}, (err)->
					expect(err).to.exist
					done()

			it "should always get inS3 even when no filter is passed", (done)->
				@DocManager._getDoc @project_id, @doc_id, undefined, (err)=>
					@MongoManager.findDoc.called.should.equal false
					expect(err).to.exist
					done()

			it "should not error if inS3 is set to true", (done)->
				@DocManager._getDoc @project_id, @doc_id, {inS3: true}, (err)->
					expect(err).to.not.exist
					done()

		describe "when the doc is in the doc collection", ->
			beforeEach ->
				@MongoManager.findDoc.yields(null, @doc)
				@DocManager._getDoc @project_id, @doc_id, {version: true, inS3:true}, @callback

			it "should get the doc from the doc collection", ->
				@MongoManager.findDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should get the doc version from the docOps collection", ->
				@MongoManager.getDocVersion
					.calledWith(@doc_id)
					.should.equal true
			
			it "should return the callback with the doc with the version", ->
				@callback.called.should.equal true
				doc = @callback.args[0][1]
				doc.lines.should.equal @doc.lines
				doc.version.should.equal @version

		describe "without the version filter", ->
			beforeEach ->
				@MongoManager.findDoc.yields(null, @doc)
				@DocManager._getDoc @project_id, @doc_id, {version: false, inS3:true}, @callback

			it "should not get the doc version from the docOps collection", ->
				@MongoManager.getDocVersion.called.should.equal false
		
		describe "when MongoManager.findDoc errors", ->
			beforeEach ->
				@MongoManager.findDoc.yields(@stubbedError)
				@DocManager._getDoc @project_id, @doc_id, {version: true, inS3:true}, @callback

			it "should return the error", ->
				@callback.calledWith(@stubbedError).should.equal true

		describe "when the doc is archived", ->
			beforeEach -> 
				@doc = { _id: @doc_id, project_id: @project_id, lines: ["mock-lines"], inS3: true }
				@MongoManager.findDoc.yields(null, @doc)
				@DocArchiveManager.unarchiveDoc = (project_id, doc_id, callback) =>
					@doc.inS3 = false
					callback()
				sinon.spy @DocArchiveManager, "unarchiveDoc"
				@DocManager._getDoc @project_id, @doc_id, {version: true, inS3:true}, @callback

			it "should call the DocArchive to unarchive the doc", ->
				@DocArchiveManager.unarchiveDoc.calledWith(@project_id, @doc_id).should.equal true
			
			it "should look up the doc twice", ->
				@MongoManager.findDoc.calledTwice.should.equal true

			it "should return the doc", ->
				@callback.calledWith(null, @doc).should.equal true

		describe "when the doc does not exist in the docs collection", ->
			beforeEach -> 
				@MongoManager.findDoc = sinon.stub().yields(null, null)
				@DocManager._getDoc @project_id, @doc_id, {version: true, inS3:true}, @callback

			it "should return a NotFoundError", ->
				@callback
					.calledWith(new Errors.NotFoundError("No such doc: #{@doc_id} in project #{@project_id}"))
					.should.equal true

	describe "getAllNonDeletedDocs", ->
		describe "when the project exists", ->
			beforeEach -> 
				@docs = [{ _id: @doc_id, project_id: @project_id, lines: ["mock-lines"] }]
				@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(3, null, @docs)
				@DocArchiveManager.unArchiveAllDocs = sinon.stub().callsArgWith(1, null, @docs)
				@filter = { lines: true }
				@DocManager.getAllNonDeletedDocs @project_id, @filter, @callback

			it "should get the project from the database", ->
				@MongoManager.getProjectsDocs
					.calledWith(@project_id, {include_deleted: false}, @filter)
					.should.equal true

			it "should return the docs", ->
				@callback.calledWith(null, @docs).should.equal true

		describe "when there are no docs for the project", ->
			beforeEach -> 
				@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(3, null, null)
				@DocArchiveManager.unArchiveAllDocs = sinon.stub().callsArgWith(1, null)
				@DocManager.getAllNonDeletedDocs @project_id, @filter, @callback

			it "should return a NotFoundError", ->
				@callback
					.calledWith(new Errors.NotFoundError("No docs for project #{@project_id}"))
					.should.equal true

		describe "when there are some archived docs for the project", ->
			beforeEach ->
				@stubs = [{ _id: @doc_id, project_id: @project_id, inS3:true }]
				@docs = [{ _id: @doc_id, project_id: @project_id, lines: ["mock-lines"] }]
				@MongoManager.getProjectsDocs = sinon.stub()
					.callsArgWith(3, null, @stubs) # first call
					.callsArgWith(3, null, @docs)  # second call (after unarchiving)
				@DocArchiveManager.unArchiveAllDocs = sinon.stub().callsArgWith(1, null)
				@DocManager.getAllNonDeletedDocs @project_id, @filter, @callback

			it "should get the project from the database", ->
				@MongoManager.getProjectsDocs
					.calledWith(@project_id, {include_deleted: false}, @filter)
					.should.equal true

			it "should unarchive the documents", ->
				@DocArchiveManager.unArchiveAllDocs
					.calledWith(@project_id)
					.should.equal true

			it "should return the docs", ->
				@callback.calledWith(null, @docs).should.equal true

	describe "deleteDoc", ->
		describe "when the doc exists", ->
			beforeEach ->
				@lines = ["mock", "doc", "lines"]
				@rev = 77
				@DocManager.checkDocExists = sinon.stub().callsArgWith(2, null, true)
				@MongoManager.markDocAsDeleted = sinon.stub().callsArg(2)
				@DocManager.deleteDoc @project_id, @doc_id, @callback

			it "should get the doc", ->
				@DocManager.checkDocExists
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should mark doc as deleted", ->
				@MongoManager.markDocAsDeleted
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should return the callback", ->
				@callback.called.should.equal true

		describe "when the doc does not exist", ->
			beforeEach -> 
				@DocManager.checkDocExists = sinon.stub().callsArgWith(2, null, false)
				@DocManager.deleteDoc @project_id, @doc_id, @callback

			it "should return a NotFoundError", ->
				@callback
					.calledWith(new Errors.NotFoundError("No such doc: #{@doc_id}"))
					.should.equal true

	describe "updateDoc", ->
		beforeEach ->
			@oldDocLines = ["old", "doc", "lines"]
			@newDocLines = ["new", "doc", "lines"]
			@originalRanges = {
				changes: [{
					id: ObjectId().toString()
					op: { i: "foo", p: 3 }
					meta:
						user_id: ObjectId().toString()
						ts: new Date().toString()
				}]
			}
			@newRanges = {
				changes: [{
					id: ObjectId().toString()
					op: { i: "bar", p: 6 }
					meta:
						user_id: ObjectId().toString()
						ts: new Date().toString()
				}]
			}
			@version = 42
			@doc = { _id: @doc_id, project_id: @project_id, lines: @oldDocLines, rev: @rev = 5, version: @version, ranges: @originalRanges }

			@MongoManager.upsertIntoDocCollection = sinon.stub().callsArg(3)
			@MongoManager.setDocVersion = sinon.stub().yields()
			@DocManager._getDoc = sinon.stub()

		describe "when only the doc lines have changed", ->
			beforeEach ->
				@DocManager._getDoc = sinon.stub().callsArgWith(3, null, @doc)
				@DocManager.updateDoc @project_id, @doc_id, @newDocLines, @version, @originalRanges, @callback

			it "should get the existing doc", ->
				@DocManager._getDoc
					.calledWith(@project_id, @doc_id, {version: true, rev: true, lines: true, version: true, ranges: true, inS3:true})
					.should.equal true

			it "should upsert the document to the doc collection", ->
				@MongoManager.upsertIntoDocCollection
					.calledWith(@project_id, @doc_id, {lines: @newDocLines})
					.should.equal true
			
			it "should not update the version", ->
				@MongoManager.setDocVersion.called.should.equal false

			it "should return the callback with the new rev", ->
				@callback.calledWith(null, true, @rev + 1).should.equal true

		describe "when the doc ranges have changed", ->
			beforeEach ->
				@DocManager._getDoc = sinon.stub().callsArgWith(3, null, @doc)
				@RangeManager.shouldUpdateRanges.returns true
				@DocManager.updateDoc @project_id, @doc_id, @oldDocLines, @version, @newRanges, @callback

			it "should upsert the ranges", ->
				@MongoManager.upsertIntoDocCollection
					.calledWith(@project_id, @doc_id, {ranges: @newRanges})
					.should.equal true
			
			it "should not update the version", ->
				@MongoManager.setDocVersion.called.should.equal false

			it "should return the callback with the new rev", ->
				@callback.calledWith(null, true, @rev + 1).should.equal true

		describe "when only the version has changed", ->
			beforeEach ->
				@DocManager._getDoc = sinon.stub().callsArgWith(3, null, @doc)
				@DocManager.updateDoc @project_id, @doc_id, @oldDocLines, @version + 1, @originalRanges, @callback

			it "should not change the lines or ranges", ->
				@MongoManager.upsertIntoDocCollection.called.should.equal false
			
			it "should update the version", ->
				@MongoManager.setDocVersion
					.calledWith(@doc_id, @version + 1)
					.should.equal true

			it "should return the callback with the old rev", ->
				@callback.calledWith(null, true, @rev).should.equal true

		describe "when the doc has not changed at all", ->
			beforeEach ->
				@DocManager._getDoc = sinon.stub().callsArgWith(3, null, @doc)
				@DocManager.updateDoc @project_id, @doc_id, @oldDocLines, @version, @originalRanges, @callback

			it "should not update the ranges or lines", ->
				@MongoManager.upsertIntoDocCollection.called.should.equal false
			
			it "should not update the version", ->
				@MongoManager.setDocVersion.called.should.equal false

			it "should return the callback with the old rev and modified == false", ->
				@callback.calledWith(null, false, @rev).should.equal true

		describe "when the version is null", ->
			beforeEach ->
				@DocManager.updateDoc @project_id, @doc_id, @newDocLines, null, @originalRanges, @callback

			it "should return an error", ->
				@callback.calledWith(new Error("no lines, version or ranges provided")).should.equal true

		describe "when the lines are null", ->
			beforeEach ->
				@DocManager.updateDoc @project_id, @doc_id, null, @version, @originalRanges, @callback

			it "should return an error", ->
				@callback.calledWith(new Error("no lines, version or ranges provided")).should.equal true

		describe "when the ranges are null", ->
			beforeEach ->
				@DocManager.updateDoc @project_id, @doc_id, @newDocLines, @version, null, @callback

			it "should return an error", ->
				@callback.calledWith(new Error("no lines, version or ranges provided")).should.equal true

		describe "when there is a generic error getting the doc", ->
			beforeEach ->
				@error =  new Error("doc could not be found")
				@DocManager._getDoc = sinon.stub().callsArgWith(3, @error, null, null)
				@DocManager.updateDoc @project_id, @doc_id, @newDocLines, @version, @originalRanges, @callback
			
			it "should not upsert the document to the doc collection", ->
				@MongoManager.upsertIntoDocCollection.called.should.equal false

			it "should return the callback with the error", ->
				@callback.calledWith(@error).should.equal true

		describe "when the doc lines have not changed", ->
			beforeEach ->
				@DocManager._getDoc = sinon.stub().callsArgWith(3, null, @doc)
				@DocManager.updateDoc @project_id, @doc_id, @oldDocLines.slice(), @version, @originalRanges, @callback

			it "should not update the doc", ->
				@MongoManager.upsertIntoDocCollection.called.should.equal false

			it "should return the callback with the existing rev", ->
				@callback.calledWith(null, false, @rev).should.equal true

		describe "when the doc does not exist", ->
			beforeEach ->
				@DocManager._getDoc = sinon.stub().callsArgWith(3, null, null, null)
				@DocManager.updateDoc @project_id, @doc_id, @newDocLines, @version, @originalRanges, @callback
			
			it "should upsert the document to the doc collection", ->
				@MongoManager.upsertIntoDocCollection
					.calledWith(@project_id, @doc_id, {lines: @newDocLines, ranges: @originalRanges})
					.should.equal true
				
			it "should set the version", ->
				@MongoManager.setDocVersion
					.calledWith(@doc_id, @version)
					.should.equal true

			it "should return the callback with the new rev", ->
				@callback.calledWith(null, true, 1).should.equal true
