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
