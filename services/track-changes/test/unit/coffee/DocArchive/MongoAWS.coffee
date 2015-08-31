chai = require('chai')
chai.should()
sinon = require("sinon")
modulePath = "../../../../app/js/MongoAWS.js"
SandboxedModule = require('sandboxed-module')
{ObjectId} = require("mongojs")

describe "MongoAWS", ->
	beforeEach ->
		@MongoAWS = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings =
				filestore:
					s3:
						secret: "s3-secret"
						key: "s3-key"
					stores:
						user_files: "s3-bucket"
			"child_process": @child_process = {}
			"mongo-uri": @mongouri = {}
			"logger-sharelatex": @logger = {log: sinon.stub(), error: sinon.stub(), err:->}
			"aws-sdk": @awssdk = {}
			"fs": @fs = {}
			"s3-streams": @s3streams = {}
			"./mongojs" : { db: @db = {}, ObjectId: ObjectId }
			"JSONStream": @JSONStream = {}
			"readline-stream": @readline = sinon.stub()

		@bulkLimit = @MongoAWS.bulkLimit
		@project_id = ObjectId().toString()
		@doc_id = ObjectId().toString()
		@callback = sinon.stub()
		
	describe "archiveDocHistory", ->

		beforeEach ->
			@awssdk.config = { update: sinon.stub() } 
			@awssdk.S3 = sinon.stub()
			@s3streams.WriteStream = sinon.stub()
			@db.docHistory = {}
			@db.docHistory.pipe = sinon.stub()
			@db.docHistory.find = sinon.stub().returns @db.docHistory
			@db.docHistory.pipe.returns
				pipe:->
					on: (type, cb)-> 
						if type == "finish"
							cb()
			@JSONStream.stringify = sinon.stub()

			@MongoAWS.archiveDocHistory @project_id, @doc_id, @callback

		it "should call the callback", ->
			@callback.calledWith(null).should.equal true

	describe "unArchiveDocHistory", ->

		beforeEach ->
			@awssdk.config = { update: sinon.stub() } 
			@awssdk.S3 = sinon.stub()
			@s3streams.ReadStream = sinon.stub()

			@s3streams.ReadStream.returns
				#describe on 'open' behavior
				on: (type, cb)->
					pipe:->
						#describe on 'data' behavior
						on: (type, cb)->
							cb([])
							#describe on 'end' behavior
							on: (type, cb)-> 
								cb()
								#describe on 'error' behavior
								on: sinon.stub()

			@MongoAWS.handleBulk = sinon.stub()
			@MongoAWS.unArchiveDocHistory @project_id, @doc_id, @callback

		it "should call handleBulk", ->
			@MongoAWS.handleBulk.calledWith([],@callback).should.equal true
