assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/DocArchiveManager.js"
SandboxedModule = require('sandboxed-module')
ObjectId = require("mongojs").ObjectId
Errors = require "../../../app/js/Errors"

describe "DocArchiveManager", ->

	beforeEach ->

		@settings =
			filestore:
				backend: "s3"
				s3:
					secret: "secret"
					key: "this_key"
				stores:
					user_files:"sl_user_files"

		@request = 
			put: {}
			get: {}

		@docs = [{
			_id: ObjectId()
			lines: ["one", "two", "three"]
			rev: 2
			inS3: true
		}, {
			_id: ObjectId()
			lines: ["aaa", "bbb", "ccc"]
			rev: 4
			inS3: true
		}, {
			_id: ObjectId()
			lines: ["111", "222", "333"]
			rev: 6
			inS3: true
		}]

		@MongoManager =
			markDocAsArchived: sinon.stub().callsArgWith(2, null)
			upsertIntoDocCollection: sinon.stub().callsArgWith(3, null)
			getProjectsDocs: sinon.stub().callsArgWith(1, null, @docs)
			getArchivedProjectDocs: sinon.stub().callsArgWith(1, null, @docs)

		@requires = 
			"settings-sharelatex": @settings
			"./MongoManager": @MongoManager
			"request": @request
			"logger-sharelatex":
				log:->
				err:->

		@error = "my errror"
		@project_id = ObjectId().toString()
		@stubbedError = new Errors.NotFoundError("blew up")

	describe "archiveDoc", ->

		it "should use correct options", (done)->
			@request.put = sinon.stub().callsArgWith(1,  null, statusCode:200)
			@requires["request"] = @request
			@DocArchiveManager = SandboxedModule.require modulePath, requires: @requires

			@DocArchiveManager.archiveDoc @project_id, @docs[0], (err)=>
				opts = @request.put.args[0][0]
				assert.deepEqual(opts.aws, {key:@settings.filestore.s3.key, secret:@settings.filestore.s3.secret, bucket:@settings.filestore.stores.user_files})
				opts.json.should.equal @docs[0].lines
				opts.timeout.should.equal (30*1000)
				opts.uri.should.equal "https://#{@settings.filestore.stores.user_files}.s3.amazonaws.com/#{@project_id}/#{@docs[0]._id}"
				done()

		it "should return the error", (done)->
			@request.put = sinon.stub().callsArgWith(1, @error, {})
			@requires["request"] = @request
			@DocArchiveManager = SandboxedModule.require modulePath, requires: @requires

			@DocArchiveManager.archiveDoc @project_id, @docs[0], (err)=>
				err.should.equal @error
				done()

	describe "unarchiveDoc", ->

		it "should use correct options", (done)->
			@request.get = sinon.stub().callsArgWith(1,  null, statusCode:200, @docs[0].lines)
			@requires["request"] = @request
			@DocArchiveManager = SandboxedModule.require modulePath, requires: @requires

			@DocArchiveManager.unarchiveDoc @project_id, @docs[0]._id, (err)=>
				opts = @request.get.args[0][0]
				assert.deepEqual(opts.aws, {key:@settings.filestore.s3.key, secret:@settings.filestore.s3.secret, bucket:@settings.filestore.stores.user_files})
				opts.json.should.equal true
				opts.timeout.should.equal (30*1000)
				opts.uri.should.equal "https://#{@settings.filestore.stores.user_files}.s3.amazonaws.com/#{@project_id}/#{@docs[0]._id}"
				done()

		it "should return the error", (done)->
			@request.get = sinon.stub().callsArgWith(1, @error, {}, {})
			@requires["request"] = @request
			@DocArchiveManager = SandboxedModule.require modulePath, requires: @requires

			@DocArchiveManager.unarchiveDoc @project_id, @docs[0], (err)=>
				err.should.equal @error
				done()

	describe "archiveAllDocs", ->

		it "should archive all project docs", (done)->
			@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(1, null, @docs)
			@requires["./MongoManager"] = @MongoManager
			@DocArchiveManager = SandboxedModule.require modulePath, requires: @requires
			@DocArchiveManager.archiveDoc = sinon.stub().callsArgWith(2, null)

			@DocArchiveManager.archiveAllDocs @project_id, (err)=>
				for doc in @docs
					@DocArchiveManager.archiveDoc.calledWith(@project_id, doc).should.equal true
				should.not.exist err
				done()

		it "should return error if have no docs", (done)->
			@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(1, null, null)
			@requires["./MongoManager"] = @MongoManager
			@DocArchiveManager = SandboxedModule.require modulePath, requires: @requires

			@DocArchiveManager.archiveAllDocs @project_id, (err)=>
				should.exist err
				done()

		it "should return the error", (done)->
			@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(1, @error, null)
			@requires["./MongoManager"] = @MongoManager
			@DocArchiveManager = SandboxedModule.require modulePath, requires: @requires

			@DocArchiveManager.archiveAllDocs @project_id, (err)=>
				err.should.equal @error
				done()

	describe "unArchiveAllDocs", ->

		it "should unarchive all inS3 docs", (done)->
			@MongoManager.getArchivedProjectDocs = sinon.stub().callsArgWith(1, null, @docs)
			@requires["./MongoManager"] = @MongoManager
			@DocArchiveManager = SandboxedModule.require modulePath, requires: @requires
			@DocArchiveManager.unarchiveDoc = sinon.stub().callsArgWith(2, null)

			@DocArchiveManager.unArchiveAllDocs @project_id, (err)=>
				for doc in @docs
					@DocArchiveManager.unarchiveDoc.calledWith(@project_id, doc._id).should.equal true
				should.not.exist err
				done()

		it "should return error if have no docs", (done)->
			@MongoManager.getArchivedProjectDocs = sinon.stub().callsArgWith(1, null, null)
			@requires["./MongoManager"] = @MongoManager
			@DocArchiveManager = SandboxedModule.require modulePath, requires: @requires

			@DocArchiveManager.unArchiveAllDocs @project_id, (err)=>
				should.exist err
				done()

		it "should return the error", (done)->
			@MongoManager.getArchivedProjectDocs = sinon.stub().callsArgWith(1, @error, null)
			@requires["./MongoManager"] = @MongoManager
			@DocArchiveManager = SandboxedModule.require modulePath, requires: @requires

			@DocArchiveManager.unArchiveAllDocs @project_id, (err)=>
				err.should.equal @error
				done()
