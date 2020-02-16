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

		@unarchivedDocs = [{
			_id: ObjectId()
			lines: ["wombat", "potato", "banana"]
			rev: 2
		}, {
			_id: ObjectId()
			lines: ["llama", "turnip", "apple"]
			rev: 4
		}, {
			_id: ObjectId()
			lines: ["elephant", "swede", "nectarine"]
			rev: 6
		}]

		@mixedDocs = @archivedDocs.concat(@unarchivedDocs)

		@MongoManager =
			markDocAsArchived: sinon.stub().callsArgWith(2, null)
			upsertIntoDocCollection: sinon.stub().callsArgWith(3, null)
			getProjectsDocs: sinon.stub().callsArgWith(3, null, @mongoDocs)
			getArchivedProjectDocs: sinon.stub().callsArgWith(2, null, @mongoDocs)

		@requires = 
			"settings-sharelatex": @settings
			"./MongoManager": @MongoManager
			"request": @request
			"./RangeManager": @RangeManager = {}
			"logger-sharelatex":
				log:->
				err:->
		@globals =
			JSON: JSON

		@error = "my errror"
		@project_id = ObjectId().toString()
		@stubbedError = new Errors.NotFoundError("Error in S3 request")
		@DocArchiveManager = SandboxedModule.require modulePath, requires: @requires, globals: @globals

	describe "archiveDoc", ->

		it "should use correct options", (done)->
			@request.put = sinon.stub().callsArgWith(1,  null, {statusCode:200,headers:{etag:""}})
			@DocArchiveManager.archiveDoc @project_id, @mongoDocs[0], (err)=>
				opts = @request.put.args[0][0]
				assert.deepEqual(opts.aws, {key:@settings.docstore.s3.key, secret:@settings.docstore.s3.secret, bucket:@settings.docstore.s3.bucket})
				opts.body.should.equal JSON.stringify(
					lines: @mongoDocs[0].lines
					ranges: @mongoDocs[0].ranges
					schema_v: 1
				)
				opts.timeout.should.equal (30*1000)
				opts.uri.should.equal "https://#{@settings.docstore.s3.bucket}.s3.amazonaws.com/#{@project_id}/#{@mongoDocs[0]._id}"
				done()

		it "should return no md5 error", (done)->
			data = JSON.stringify(
				lines: @mongoDocs[0].lines
				ranges: @mongoDocs[0].ranges
				schema_v: 1
			)
			@md5 = crypto.createHash("md5").update(data).digest("hex")
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

		it "should error if the doc lines are a string not an array", (done)->
			@request.get = sinon.stub().callsArgWith(1, null, statusCode:200, "this is a string")
			@request.del = sinon.stub()
			@DocArchiveManager.unarchiveDoc @project_id, @mongoDocs[0], (err)=>
				should.exist err
				@request.del.called.should.equal false
				done()

	describe "archiveAllDocs", ->

		it "should archive all project docs which are not in s3", (done)->
			@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(3, null, @mongoDocs)
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
			@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(3, null, null)

			@DocArchiveManager.archiveAllDocs @project_id, (err)=>
				should.exist err
				done()

		it "should return the error", (done)->
			@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(3, @error, null)

			@DocArchiveManager.archiveAllDocs @project_id, (err)=>
				err.should.equal @error
				done()

		describe "when most have been already put in s3", ->

			beforeEach ->
				numberOfDocs = 10 * 1000
				@mongoDocs = []
				while --numberOfDocs != 0
					@mongoDocs.push({inS3:true, _id: ObjectId()})

				@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(3, null, @mongoDocs)
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

	describe "destroyAllDocs", ->
		beforeEach ->
			@request.del = sinon.stub().callsArgWith(1, null, statusCode:204, {})
			@MongoManager.getProjectsDocs = sinon.stub().callsArgWith(3, null, @mixedDocs)
			@MongoManager.findDoc = sinon.stub().callsArgWith(3, null, null)
			@MongoManager.destroyDoc = sinon.stub().yields()
			for doc in @mixedDocs
				@MongoManager.findDoc.withArgs(@project_id, doc._id).callsArgWith(3, null, doc)

		it "should destroy all the docs", (done)->
			@DocArchiveManager.destroyDoc = sinon.stub().callsArgWith(2, null)
			@DocArchiveManager.destroyAllDocs @project_id, (err)=>
				for doc in @mixedDocs
					@DocArchiveManager.destroyDoc.calledWith(@project_id, doc._id).should.equal true
				should.not.exist err
				done()

		it "should only the s3 docs from s3", (done)->
			docOpts = (doc) =>
				JSON.parse(JSON.stringify({
					aws: {key:@settings.docstore.s3.key, secret:@settings.docstore.s3.secret, bucket:@settings.docstore.s3.bucket},
					json: true,
					timeout: 30 * 1000
					uri:"https://#{@settings.docstore.s3.bucket}.s3.amazonaws.com/#{@project_id}/#{doc._id}"
				}))

			@DocArchiveManager.destroyAllDocs @project_id, (err)=>
				expect(err).not.to.exist

				for doc in @archivedDocs
					sinon.assert.calledWith(@request.del, docOpts(doc))
				for doc in @unarchivedDocs
					expect(@request.del.calledWith(docOpts(doc))).to.equal false  # no notCalledWith

				done()

		it "should remove the docs from mongo", (done)->
			@DocArchiveManager.destroyAllDocs @project_id, (err)=>
				expect(err).not.to.exist

			for doc in @mixedDocs
				sinon.assert.calledWith(@MongoManager.destroyDoc, doc._id)

			done()
	
	describe "_s3DocToMongoDoc", ->
		describe "with the old schema", ->
			it "should return the docs lines", (done) ->
				@DocArchiveManager._s3DocToMongoDoc ["doc", "lines"], (error, doc) ->
					expect(doc).to.deep.equal {
						lines: ["doc", "lines"]
					}
					done()
		
		describe "with the new schema", ->
			it "should return the doc lines and ranges", (done) ->
				@RangeManager.jsonRangesToMongo = sinon.stub().returns {"mongo": "ranges"}
				@DocArchiveManager._s3DocToMongoDoc {
					lines: ["doc", "lines"]
					ranges: {"json": "ranges"}
					schema_v: 1
				}, (error, doc) ->
					expect(doc).to.deep.equal {
						lines: ["doc", "lines"]
						ranges: {"mongo": "ranges"}
					}
					done()
					
			it "should return just the doc lines when there are no ranges", (done) ->
				@DocArchiveManager._s3DocToMongoDoc {
					lines: ["doc", "lines"]
					schema_v: 1
				}, (error, doc) ->
					expect(doc).to.deep.equal {
						lines: ["doc", "lines"]
					}
					done()
		
		describe "with an unrecognised schema", ->
			it "should return an error", (done) ->
				@DocArchiveManager._s3DocToMongoDoc {
					schema_v: 2
				}, (error, doc) ->
					expect(error).to.exist
					done()
	
	describe "_mongoDocToS3Doc", ->
		describe "with a valid doc", ->
			it "should return the json version", (done) ->
				@DocArchiveManager._mongoDocToS3Doc doc = {
					lines: ["doc", "lines"]
					ranges: { "mock": "ranges" }
				}, (err, s3_doc) ->
					expect(s3_doc).to.equal JSON.stringify({
						lines: ["doc", "lines"]
						ranges: { "mock": "ranges" }
						schema_v: 1
					})
					done()
			
		describe "with null bytes in the result", ->
			beforeEach ->
				@_stringify = JSON.stringify
				JSON.stringify = sinon.stub().returns '{"bad": "\u0000"}'
			
			afterEach ->
				JSON.stringify = @_stringify
				
			it "should return an error", (done) ->
				@DocArchiveManager._mongoDocToS3Doc {
					lines: ["doc", "lines"]
					ranges: { "mock": "ranges" }
				}, (err, s3_doc) ->
					expect(err).to.exist
					done()
		
		describe "without doc lines", ->
			it "should return an error", (done) ->
				@DocArchiveManager._mongoDocToS3Doc {}, (err, s3_doc) ->
					expect(err).to.exist
					done()
			
			
