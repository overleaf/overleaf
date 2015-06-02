sinon = require "sinon"
chai = require("chai")
chai.should()
{ObjectId} = require "mongojs"
async = require "async"
Settings = require("settings-sharelatex")

DocstoreClient = require "./helpers/DocstoreClient"

if Settings.filestore?.backend == "s3"

	describe "Archiving all docs", ->
		beforeEach (done) ->
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

		it "should archive all the docs", (done) ->
			DocstoreClient.archiveAllDoc @project_id, (error, res) =>
				res.statusCode.should.equal 204
				done()

		it "should unarchive all the docs", (done) ->
			DocstoreClient.archiveAllDoc @project_id, (error, res) =>
				DocstoreClient.getAllDocs @project_id, (error, res, docs) =>
					throw error if error?
					docs.length.should.equal @docs.length
					for doc, i in docs
						doc.lines.should.deep.equal @docs[i].lines
					done()

