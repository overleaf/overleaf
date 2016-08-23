sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/ShareJsDB.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors"

describe "ShareJsDB.getSnapshot", ->
	beforeEach ->
		@doc_id = "document-id"
		@project_id = "project-id"
		@doc_key = "#{@project_id}:#{@doc_id}"
		@callback = sinon.stub()
		@ShareJsDB = SandboxedModule.require modulePath, requires:
			"./DocumentManager": @DocumentManager = {}
			"./RedisManager": {}
			"./DocOpsManager": {}
			"logger-sharelatex": {}
		@db = new @ShareJsDB()

		@version = 42

	describe "with a text document", ->
		beforeEach ->
			@lines = ["one", "two", "three"]

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version)
				@db.getSnapshot @doc_key, @callback

			it "should get the doc", ->
				@DocumentManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should return the doc lines", ->
				@callback.args[0][1].snapshot.should.equal @lines.join("\n")

			it "should return the doc version", ->
				@callback.args[0][1].v.should.equal @version

			it "should return the type as text", ->
				@callback.args[0][1].type.should.equal "text"

		describe "when the doclines do not exist", ->
			beforeEach ->
				@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, null, null)
				@db.getSnapshot @doc_key, @callback

			it "should return the callback with a NotFoundError", ->
				@callback.calledWith(new Errors.NotFoundError("not found")).should.equal true

		describe "when getDoc returns an error", ->
			beforeEach ->
				@DocumentManager.getDoc = sinon.stub().callsArgWith(2, @error = new Error("oops"), null, null)
				@db.getSnapshot @doc_key, @callback

			it "should return the callback with an error", ->
				@callback.calledWith(@error).should.equal true

	describe "with a JSON document", ->
		beforeEach ->
			@lines = [{text: "one"}, {text:"two"}, {text:"three"}]

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version)
				@db.getSnapshot @doc_key, @callback

			it "should get the doc", ->
				@DocumentManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should return the doc lines", ->
				expect(@callback.args[0][1].snapshot).to.deep.equal lines: @lines

			it "should return the doc version", ->
				@callback.args[0][1].v.should.equal @version

			it "should return the type as text", ->
				@callback.args[0][1].type.should.equal "json"


	
