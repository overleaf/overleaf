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
			put: sinon.stub().callsArgWith(1,  null, statusCode:200)

		@MongoManager =
			markDocAsArchived: sinon.stub().callsArgWith(2, null)
			upsertIntoDocCollection: sinon.stub()

		@DocArchiveManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings
			"./MongoManager": @MongoManager
			"request": @request
			"logger-sharelatex":
				log:->
				err:->

		@key = "my/key"
		@bucketName = "my-bucket"
		@error = "my errror"

		@docs = [{
			_id: ObjectId()
			lines: ["one", "two", "three"]
			rev: 2
		}, {
			_id: ObjectId()
			lines: ["aaa", "bbb", "ccc"]
			rev: 4
		}, {
			_id: ObjectId()
			lines: ["111", "222", "333"]
			rev: 6
		}]

		@project_id = ObjectId().toString()
		@callback = sinon.stub()
		@stubbedError = new Error("blew up")

	describe "archiveDoc", ->

		it "should use correct options", (done)->
			@DocArchiveManager.archiveDoc @project_id, @docs[0], (err)=>
				opts = @request.put.args[0][0]
				assert.deepEqual(opts.aws, {key:@settings.filestore.s3.key, secret:@settings.filestore.s3.secret, bucket:@settings.filestore.stores.user_files})
				opts.json.should.equal @docs[0].lines
				opts.timeout.should.equal (30*1000)
				opts.uri.should.equal "https://#{@settings.filestore.stores.user_files}.s3.amazonaws.com/#{@project_id}/#{@docs[0]._id}"
				done()