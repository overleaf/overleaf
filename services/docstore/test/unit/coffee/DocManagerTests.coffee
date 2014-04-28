SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
chai = require('chai')
chai.should()
expect = chai.expect
modulePath = require('path').join __dirname, '../../../app/js/DocManager'
ObjectId = require("mongojs").ObjectId
Errors = require "../../../app/js/Errors"

describe "DocManager", ->
	beforeEach ->
		@DocManager = SandboxedModule.require modulePath, requires:
			"./MongoManager": @MongoManager = {}
			"logger-sharelatex": @logger = {log: sinon.stub()}
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()
		@callback = sinon.stub()

	describe "getDoc", ->
		describe "when the project exists", ->
			beforeEach -> 
				@project = { name: "mock-project" }
				@doc = { _id: @doc_id, lines: ["mock-lines"] }
				@mongoPath = "mock.mongo.path"
				@MongoManager.findProject = sinon.stub().callsArgWith(1, null, @project)
				@DocManager.findDocInProject = sinon.stub().callsArgWith(2, null, @doc, @mongoPath)
				@DocManager.getDoc @project_id, @doc_id, @callback

			it "should get the project from the database", ->
				@MongoManager.findProject
					.calledWith(@project_id)
					.should.equal true

			it "should find the doc in the project", ->
				@DocManager.findDocInProject
					.calledWith(@project, @doc_id)
					.should.equal true

			it "should return the doc", ->
				@callback.calledWith(null, @doc, @mongoPath).should.equal true

		describe "when the project does not exist", ->
			beforeEach -> 
				@MongoManager.findProject = sinon.stub().callsArgWith(1, null, @null)
				@DocManager.findDocInProject = sinon.stub()
				@DocManager.getDoc @project_id, @doc_id, @callback

			it "should not try to find the doc in the project", ->
				@DocManager.findDocInProject.called.should.equal false

			it "should return a NotFoundError", ->
				@callback
					.calledWith(new Errors.NotFoundError("No such project: #{@project_id}"))
					.should.equal true

		describe "when the doc does not exist", ->
			beforeEach -> 
				@project = { name: "mock-project" }
				@MongoManager.findProject = sinon.stub().callsArgWith(1, null, @project)
				@DocManager.findDocInProject = sinon.stub().callsArgWith(2, null, null, null)
				@DocManager.getDoc @project_id, @doc_id, @callback

			it "should try to find the doc in the project", ->
				@DocManager.findDocInProject
					.calledWith(@project, @doc_id)
					.should.equal true

			it "should return a NotFoundError", ->
				@callback
					.calledWith(new Errors.NotFoundError("No such doc: #{@doc_id}"))
					.should.equal true

	describe "updateDoc", ->
		beforeEach ->
			@oldDocLines = ["old", "doc", "lines"]
			@newDocLines = ["new", "doc", "lines"]
			@doc = { _id: @doc_id, lines: @oldDocLines, rev: 42 }
			@mongoPath = "mock.mongo.path"

			@MongoManager.updateDoc = sinon.stub().callsArg(3)

		describe "when the doc lines have changed", ->
			beforeEach ->
				@DocManager.getDoc = sinon.stub().callsArgWith(2, null, @doc, @mongoPath)
				@DocManager.updateDoc @project_id, @doc_id, @newDocLines, @callback

			it "should get the existing doc", ->
				@DocManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should update the doc with the new doc lines", ->
				@MongoManager.updateDoc
					.calledWith(@project_id, @mongoPath, @newDocLines)
					.should.equal true

			it "should log out the old and new doc lines", ->
				@logger.log
					.calledWith(
						project_id: @project_id
						doc_id: @doc_id
						oldDocLines: @oldDocLines
						newDocLines: @newDocLines
						rev: @doc.rev
						"updating doc lines"
					)
					.should.equal true

			it "should return the callback", ->
				@callback.called.should.equal true

		describe "when the doc lines have not changed", ->
			beforeEach ->
				@DocManager.getDoc = sinon.stub().callsArgWith(2, null, @doc, @mongoPath)
				@DocManager.updateDoc @project_id, @doc_id, @oldDocLines.slice(), @callback

			it "should not update the doc", ->
				@MongoManager.updateDoc.called.should.equal false

			it "should return the callback", ->
				@callback.called.should.equal true

		describe "when the doc does not exist", ->
			beforeEach ->
				@DocManager.getDoc = sinon.stub().callsArgWith(2, null, null, null)
				@DocManager.updateDoc @project_id, @doc_id, @newDocLines, @callback

			it "should not try to update the doc", ->
				@MongoManager.updateDoc.called.should.equal false

			it "should return a NotFoundError", ->
				@callback
					.calledWith(new Errors.NotFoundError("No such project/doc: #{@project_id}/#{@doc_id}"))
					.should.equal true

	describe "findDocInProject", ->
		it "should find the doc when it is in the root folder", (done) ->
			@DocManager.findDocInProject {
				rootFolder: [{
					docs: [{
						_id: ObjectId(@doc_id)
					}]
				}]
			}, @doc_id, (error, doc, mongoPath) =>
				expect(doc).to.deep.equal { _id: ObjectId(@doc_id) }
				mongoPath.should.equal "rootFolder.0.docs.0"
				done()

		it "should find the doc when it is in a sub folder", (done) ->
			@DocManager.findDocInProject {
				rootFolder: [{
					folders: [{
						docs: [{
							_id: ObjectId(@doc_id)
						}]
					}]
				}]
			}, @doc_id, (error, doc, mongoPath) =>
				expect(doc).to.deep.equal { _id: ObjectId(@doc_id) }
				mongoPath.should.equal "rootFolder.0.folders.0.docs.0"
				done()

		it "should find the doc when it there are other docs", (done) ->
			@DocManager.findDocInProject {
				rootFolder: [{
					folders: [{
						docs: [{
							_id: ObjectId()
						}]
					}, {
						docs: [{
							_id: ObjectId()
						}, {
							_id: ObjectId(@doc_id)
						}]
					}],
					docs: [{
						_id: ObjectId()
					}]
				}]
			}, @doc_id, (error, doc, mongoPath) =>
				expect(doc).to.deep.equal { _id: ObjectId(@doc_id) }
				mongoPath.should.equal "rootFolder.0.folders.1.docs.1"
				done()

		it "should return null when the doc doesn't exist", (done) ->
			@DocManager.findDocInProject {
				rootFolder: [{
					folders: [{
						docs: []
					}]
				}]
			}, @doc_id, (error, doc, mongoPath) =>
				expect(doc).to.be.null
				expect(mongoPath).to.be.null
				done()
