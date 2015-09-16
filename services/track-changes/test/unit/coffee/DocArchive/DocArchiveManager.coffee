chai = require('chai')
sinon = require("sinon")
should = chai.should()
modulePath = "../../../../app/js/DocArchiveManager.js"
SandboxedModule = require('sandboxed-module')
ObjectId = require("mongojs").ObjectId

describe "DocArchiveManager", ->
	beforeEach ->
		@DocArchiveManager = SandboxedModule.require modulePath, requires:
			"./MongoManager" : @MongoManager = sinon.stub()
			"./MongoAWS" : @MongoAWS = sinon.stub()
			"./LockManager" : @LockManager = sinon.stub()
			"./DocstoreHandler" : @DocstoreHandler = sinon.stub()
			"logger-sharelatex": @logger = {log: sinon.stub(), error: sinon.stub(), err:->}
			"settings-sharelatex": @settings =
				filestore:
					backend: 's3'

		@mongoDocs = [{
			_id: ObjectId()
		}, {
			_id: ObjectId()
		}, {
			_id: ObjectId()
		}]

		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@callback = sinon.stub()
		
	describe "archiveAllDocsChanges", ->
		it "should archive all project docs change", (done)->
			@DocstoreHandler.getAllDocs = sinon.stub().callsArgWith(1, null, @mongoDocs)
			@DocArchiveManager.archiveDocChangesWithLock = sinon.stub().callsArgWith(2, null)
			
			@DocArchiveManager.archiveAllDocsChanges @project_id, (err)=>
				@DocArchiveManager.archiveDocChangesWithLock.calledWith(@project_id, @mongoDocs[0]._id).should.equal true
				@DocArchiveManager.archiveDocChangesWithLock.calledWith(@project_id, @mongoDocs[1]._id).should.equal true
				@DocArchiveManager.archiveDocChangesWithLock.calledWith(@project_id, @mongoDocs[2]._id).should.equal true
				should.not.exist err
				done()

	describe "archiveDocChangesWithLock", ->
		beforeEach ->
			@DocArchiveManager.archiveDocChanges = sinon.stub().callsArg(2)
			@LockManager.runWithLock = sinon.stub().callsArg(2)
			@DocArchiveManager.archiveDocChangesWithLock @project_id, @doc_id, @callback

		it "should run archiveDocChangesWithLock with the lock", ->
			@LockManager.runWithLock
				.calledWith(
					"HistoryLock:#{@doc_id}"
				)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "archiveDocChanges", ->
		beforeEach ->
			@update = { _id: ObjectId(), op: "op", meta: "meta", v: "v"}
			@MongoManager.getDocChangesCount = sinon.stub().callsArg(1)
			@MongoManager.getLastCompressedUpdate = sinon.stub().callsArgWith(1, null, @update)
			@MongoAWS.archiveDocHistory = sinon.stub().callsArg(2)
			@MongoManager.markDocHistoryAsArchived = sinon.stub().callsArg(2)
			@DocArchiveManager.archiveDocChanges @project_id, @doc_id, @callback

		it "should run markDocHistoryAsArchived with doc_id and update", ->
			@MongoManager.markDocHistoryAsArchived
				.calledWith(
					@doc_id, @update
				)
				.should.equal true
		it "should call the callback", ->
			@callback.called.should.equal true
		
	describe "unArchiveAllDocsChanges", ->
		it "should unarchive all project docs change", (done)->
			@DocstoreHandler.getAllDocs = sinon.stub().callsArgWith(1, null, @mongoDocs)
			@DocArchiveManager.unArchiveDocChangesWithLock = sinon.stub().callsArgWith(2, null)
			
			@DocArchiveManager.unArchiveAllDocsChanges @project_id, (err)=>
				@DocArchiveManager.unArchiveDocChangesWithLock.calledWith(@project_id, @mongoDocs[0]._id).should.equal true
				@DocArchiveManager.unArchiveDocChangesWithLock.calledWith(@project_id, @mongoDocs[1]._id).should.equal true
				@DocArchiveManager.unArchiveDocChangesWithLock.calledWith(@project_id, @mongoDocs[2]._id).should.equal true
				should.not.exist err
				done()

	describe "unArchiveDocChangesWithLock", ->
		beforeEach ->
			@DocArchiveManager.unArchiveDocChanges = sinon.stub().callsArg(2)
			@LockManager.runWithLock = sinon.stub().callsArg(2)
			@DocArchiveManager.unArchiveDocChangesWithLock @project_id, @doc_id, @callback

		it "should run unArchiveDocChangesWithLock with the lock", ->
			@LockManager.runWithLock
				.calledWith(
					"HistoryLock:#{@doc_id}"
				)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "unArchiveDocChanges", ->
		beforeEach ->
			@MongoManager.getArchivedDocChanges = sinon.stub().callsArg(1)
			@MongoAWS.unArchiveDocHistory = sinon.stub().callsArg(2)
			@MongoManager.markDocHistoryAsUnarchived = sinon.stub().callsArg(1)
			@DocArchiveManager.unArchiveDocChanges @project_id, @doc_id, @callback

		it "should run markDocHistoryAsUnarchived with doc_id", ->
			@MongoManager.markDocHistoryAsUnarchived
				.calledWith(
					@doc_id
				)
				.should.equal true
		it "should call the callback", ->
			@callback.called.should.equal true
