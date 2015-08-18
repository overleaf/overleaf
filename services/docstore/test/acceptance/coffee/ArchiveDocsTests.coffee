sinon = require "sinon"
chai = require("chai")
should = chai.should()
{db, ObjectId} = require "../../../app/js/mongojs"
async = require "async"
Settings = require("settings-sharelatex")

DocstoreClient = require "./helpers/DocstoreClient"


describe "Archiving all docs", ->
	beforeEach (done) ->
		@callback = sinon.stub()
		@project_id = ObjectId()
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
		jobs = for doc in @docs
			do (doc) =>
				(callback) =>
					DocstoreClient.createDoc @project_id, doc._id, doc.lines, (err)=>
						doc.lines[0] = doc.lines[0]+" added"
						DocstoreClient.updateDoc @project_id, doc._id, doc.lines, callback
		async.series jobs, done 

	afterEach (done) ->
		db.docs.remove({project_id: @project_id}, done)


	describe "Archiving all docs", ->
		beforeEach (done) ->

			DocstoreClient.archiveAllDoc @project_id, (error, @res) =>
				done()

		it "should archive all the docs", (done) ->
			@res.statusCode.should.equal 204
			done()

		it "should set inS3 and unset lines in each doc", (done) ->

			jobs = for archiveDoc in @docs
				do (archiveDoc) =>
					(callback) => 
						db.docs.findOne _id: archiveDoc._id, (error, doc) =>
							should.not.exist doc.lines
							doc.inS3.should.equal true
							callback()
			async.series jobs, done

		it "should be able get the same docs back", (done) ->

			jobs = for archiveDoc in @docs
				do (archiveDoc) =>
					(callback) => 
						DocstoreClient.getS3Doc @project_id, archiveDoc._id, (error, res, doc) =>
							doc.toString().should.equal archiveDoc.lines.toString()
							callback()
			async.series jobs, done

	describe "Arching all docs twice", ->
		beforeEach (done) ->
			DocstoreClient.archiveAllDoc @project_id, (error, @res) =>
				@res.statusCode.should.equal 204
				DocstoreClient.archiveAllDoc @project_id, (error, @res) =>
					@res.statusCode.should.equal 204
					done()

		it "should archive all the docs", (done) ->
			@res.statusCode.should.equal 204
			done()

		it "should set inS3 and unset lines in each doc", (done) ->

			jobs = for archiveDoc in @docs
				do (archiveDoc) =>
					(callback) => 
						db.docs.findOne _id: archiveDoc._id, (error, doc) =>
							should.not.exist doc.lines
							doc.inS3.should.equal true
							callback()
			async.series jobs, done

		it "should be able get the same docs back", (done) ->

			jobs = for archiveDoc in @docs
				do (archiveDoc) =>
					(callback) => 
						DocstoreClient.getS3Doc @project_id, archiveDoc._id, (error, res, doc) =>
							doc.toString().should.equal archiveDoc.lines.toString()
							callback()
			async.series jobs, done



	describe "archiving massive document", (done)->
		beforeEach (done)->
			@timeout 1000 * 30
			quarterMegInBytes = 250000
			lines = require("crypto").randomBytes(quarterMegInBytes).toString("hex")
			@docs[1].lines = [lines,lines,lines,lines]
			DocstoreClient.updateDoc @project_id, @docs[1]._id, @docs[1].lines, =>
				DocstoreClient.archiveAllDoc @project_id, (error, @res) =>
					done()
		

		it "should archive all the docs", (done) ->
			@res.statusCode.should.equal 204
			done()

		it "should set inS3 and unset lines in each doc", (done) ->
			jobs = for archiveDoc in @docs
				do (archiveDoc) =>
					(callback) => 
						db.docs.findOne _id: archiveDoc._id, (error, doc) =>
							should.not.exist doc.lines
							doc.inS3.should.equal true
							callback()
			async.series jobs, done

		it "should be able get the same docs back", (done) ->

			jobs = for archiveDoc in @docs
				do (archiveDoc) =>
					(callback) => 
						DocstoreClient.getS3Doc @project_id, archiveDoc._id, (error, res, doc) =>
							doc.toString().should.equal archiveDoc.lines.toString()
							callback()
			async.series jobs, done

	describe "Unarchiving all docs", ->

		it "should unarchive all the docs", (done) ->
			DocstoreClient.archiveAllDoc @project_id, (error, res) =>
				DocstoreClient.getAllDocs @project_id, (error, res, docs) =>
					throw error if error?
					docs.length.should.equal @docs.length
					for doc, i in docs
						doc.lines.should.deep.equal @docs[i].lines
					done()
