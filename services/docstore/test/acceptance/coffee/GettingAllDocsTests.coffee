sinon = require "sinon"
chai = require("chai")
chai.should()
{ObjectId} = require "mongojs"
async = require "async"

DocstoreClient = require "./helpers/DocstoreClient"

describe "Getting all docs", ->
	beforeEach (done) ->
		@project_id = ObjectId()
		@docs = [{
			_id: ObjectId()
			lines: ["one", "two", "three"]
			ranges: {"mock": "one"}
			rev: 2
		}, {
			_id: ObjectId()
			lines: ["aaa", "bbb", "ccc"]
			ranges: {"mock": "two"}
			rev: 4
		}, {
			_id: ObjectId()
			lines: ["111", "222", "333"]
			ranges: {"mock": "three"}
			rev: 6
		}]
		@deleted_doc = {
			_id: ObjectId()
			lines: ["deleted"]
			ranges: {"mock": "four"}
			rev: 8
		}
		version = 42
		jobs = for doc in @docs
			do (doc) =>
				(callback) => 
					DocstoreClient.createDoc @project_id, doc._id, doc.lines, version, doc.ranges, callback
		jobs.push (cb) =>
			DocstoreClient.createDoc @project_id, @deleted_doc._id, @deleted_doc.lines, version, @deleted_doc.ranges, (err)=>
					DocstoreClient.deleteDoc @project_id, @deleted_doc._id, cb
		async.series jobs, done 

	it "getAllDocs should return all the (non-deleted) docs", (done) ->
		DocstoreClient.getAllDocs @project_id, (error, res, docs) =>
			throw error if error?
			docs.length.should.equal @docs.length
			for doc, i in docs
				doc.lines.should.deep.equal @docs[i].lines
			done()

	it "getAllRanges should return all the (non-deleted) doc ranges", (done) ->
		DocstoreClient.getAllRanges @project_id, (error, res, docs) =>
			throw error if error?
			docs.length.should.equal @docs.length
			for doc, i in docs
				doc.ranges.should.deep.equal @docs[i].ranges
			done()


