assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/DocArchiveManager.js"
SandboxedModule = require('sandboxed-module')
ObjectId = require("mongojs").ObjectId
Errors = require "../../../app/js/Errors"
crypto = require("crypto")

describe "DocArchiveManager", ->

	beforeEach ->

		@settings =
			docstore:
				s3:
					secret: "secret"
					key: "this_key"
					bucket:"doc-archive-unit-test"

		@request = 
			put: {}
			get: {}
			del: {}

		@archivedDocs = [{
			_id: ObjectId()
			inS3:true
			rev: 2
		}, {
			_id: ObjectId()
			inS3:true
			rev: 4
		}, {
			_id: ObjectId()
			inS3:true
			rev: 6
		}]

		@mongoDocs = [{
			_id: ObjectId()
			lines: ["one", "two", "three"]
			rev: 2
		}, {
			_id: ObjectId()
			lines: ["aaa", "bbb", "ccc"]
			rev: 4
		}, {
			_id: ObjectId()
			inS3: true
			rev: 6
		}, {
			_id: ObjectId()
			inS3: true
			rev: 6
		}, {
			_id: ObjectId()
			lines: ["111", "222", "333"]
			rev: 6
		}]

		@MongoManager =
			markDocAsArchived: sinon.stub().callsArgWith(2, null)
			upsertIntoDocCollection: sinon.stub().callsArgWith(3, null)
			getProjectsDocs: sinon.stub().callsArgWith(2, null, @mongoDocs)
			getArchivedProjectDocs: sinon.stub().callsArgWith(1, null, @mongoDocs)

		@requires = 
			"settings-sharelatex": @settings
			"./MongoManager": @MongoManager
			"request": @request
			"logger-sharelatex":
				log:->
				err:->

		@error = "my errror"
		@project_id = ObjectId().toString()
		@stubbedError = new Errors.NotFoundError("Error in S3 request")
		@DocArchiveManager = SandboxedModule.require modulePath, requires: @requires

	describe "archiveDoc", ->

		it "should use correct options", (done)->
			@request.put = sinon.stub().callsArgWith(1,  null, {statusCode:200,headers:{etag:""}})
			@DocArchiveManager.archiveDoc @project_id, @mongoDocs[0], (err)=>
				opts = @request.put.args[0][0]
				assert.deepEqual(opts.aws, {key:@settings.docstore.s3.key, secret:@settings.docstore.s3.secret, bucket:@settings.docstore.s3.bucket})
				opts.json.should.equal @mongoDocs[0].lines
				opts.timeout.should.equal (30*1000)
				opts.uri.should.equal "https://#{@settings.docstore.s3.bucket}.s3.amazonaws.com/#{@project_id}/#{@mongoDocs[0]._id}"
				done()

		it "should return no md5 error", (done)->
			@md5 = crypto.createHash("md5").update(JSON.stringify(@mongoDocs[0].lines)).digest("hex")
			@request.put = sinon.stub().callsArgWith(1,  null, {statusCode:200,headers:{etag:@md5}})
			@DocArchiveManager.archiveDoc @project_id, @mongoDocs[0], (err)=>
				should.not.exist err
				done()

		it "should return the error", (done)->
			@request.put = sinon.stub().callsArgWith(1, @stubbedError, {statusCode:400,headers:{etag:""}})
			@DocArchiveManager.archiveDoc @project_id, @mongoDocs[0], (err)=>
				should.exist err
				done()

	describe "unarchiveDoc", ->

		it "should use correct options", (done)->
			@request.get = sinon.stub().callsArgWith(1, null, statusCode:200, @mongoDocs[0].lines)
			@request.del = sinon.stub().callsArgWith(1, null, statusCode:204, {})
			@DocArchiveManager.unarchiveDoc @project_id, @mongoDocs[0]._id, (err)=>
				opts = @request.get.args[0][0]
				assert.deepEqual(opts.aws, {key:@settings.docstore.s3.key, secret:@settings.docstore.s3.secret, bucket:@settings.docstore.s3.bucket})
				opts.json.should.equal true
				opts.timeout.should.equal (30*1000)
				opts.uri.should.equal "https://#{@settings.docstore.s3.bucket}.s3.amazonaws.com/#{@project_id}/#{@mongoDocs[0]._id}"
				done()

		it "should return the error", (done)->
			@request.get = sinon.stub().callsArgWith(1, @stubbedError, {}, {})
			@DocArchiveManager.unarchiveDoc @project_id, @mongoDocs[0], (err)=>
				should.exist err
				done()

	describe "archiveAllDocs", ->

		it "should archive all project docs which are not in s3", (done)->
			@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(2, null, @mongoDocs)
			@DocArchiveManager.archiveDoc = sinon.stub().callsArgWith(2, null)

			@DocArchiveManager.archiveAllDocs @project_id, (err)=>
				@DocArchiveManager.archiveDoc.calledWith(@project_id, @mongoDocs[0]).should.equal true
				@DocArchiveManager.archiveDoc.calledWith(@project_id, @mongoDocs[1]).should.equal true
				@DocArchiveManager.archiveDoc.calledWith(@project_id, @mongoDocs[4]).should.equal true

				@DocArchiveManager.archiveDoc.calledWith(@project_id, @mongoDocs[2]).should.equal false
				@DocArchiveManager.archiveDoc.calledWith(@project_id, @mongoDocs[3]).should.equal false
				
				should.not.exist err
				done()

		it "should return error if have no docs", (done)->
			@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(2, null, null)

			@DocArchiveManager.archiveAllDocs @project_id, (err)=>
				should.exist err
				done()

		it "should return the error", (done)->
			@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(2, @error, null)

			@DocArchiveManager.archiveAllDocs @project_id, (err)=>
				err.should.equal @error
				done()

		describe "when most have been already put in s3", ->

			beforeEach ->
				numberOfDocs = 10 * 1000
				@mongoDocs = []
				while --numberOfDocs != 0
					@mongoDocs.push({inS3:true, _id: ObjectId()})

				@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(2, null, @mongoDocs)
				@DocArchiveManager.archiveDoc = sinon.stub().callsArgWith(2, null)	

			it "should not throw and error", (done)->
				@DocArchiveManager.archiveAllDocs @project_id, (err)=>
					should.not.exist err
					done()


	describe "unArchiveAllDocs", ->

		it "should unarchive all inS3 docs", (done)->
			@MongoManager.getArchivedProjectDocs = sinon.stub().callsArgWith(1, null, @archivedDocs)
			@DocArchiveManager.unarchiveDoc = sinon.stub().callsArgWith(2, null)
			@DocArchiveManager.unArchiveAllDocs @project_id, (err)=>
				for doc in @archivedDocs
					@DocArchiveManager.unarchiveDoc.calledWith(@project_id, doc._id).should.equal true
				should.not.exist err
				done()

		it "should return error if have no docs", (done)->
			@MongoManager.getArchivedProjectDocs = sinon.stub().callsArgWith(1, null, null)
			@DocArchiveManager.unArchiveAllDocs @project_id, (err)=>
				should.exist err
				done()

		it "should return the error", (done)->
			@MongoManager.getArchivedProjectDocs = sinon.stub().callsArgWith(1, @error, null)
			@DocArchiveManager.unArchiveAllDocs @project_id, (err)=>
				err.should.equal @error
				done()
