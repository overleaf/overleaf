sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/PersistenceManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors"

describe "PersistenceManager.setDocInWeb", ->
	beforeEach ->
		@PersistenceManager = SandboxedModule.require modulePath, requires:
			"request": @request = sinon.stub()
			"settings-sharelatex": @Settings = {}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@lines = ["one", "two", "three"]
		@callback = sinon.stub()
		@Settings.apis =
			web:
				url: @url = "www.example.com"
				user: @user = "sharelatex"
				pass: @pass = "password"

	describe "with a successful response from the web api", ->
		beforeEach ->
			@request.callsArgWith(1, null, {statusCode: 200}, JSON.stringify(lines: @lines, version: @version))
			@PersistenceManager.setDocInWeb(@project_id, @doc_id, @lines, @callback)

		it "should call the web api", ->
			@request
				.calledWith({
					url: "#{@url}/project/#{@project_id}/doc/#{@doc_id}"
					body: JSON.stringify
						lines: @lines
					method: "POST"
					headers:
						"content-type": "application/json"
					auth:
						user: @user
						pass: @pass
						sendImmediately: true
					jar: false
				})
				.should.equal true

		it "should call the callback without error", ->
			@callback.calledWith(null).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

	describe "when request returns an error", ->
		beforeEach ->
			@request.callsArgWith(1, @error = new Error("oops"), null, null)
			@PersistenceManager.setDocInWeb(@project_id, @doc_id, @lines, @callback)

		it "should return the error", ->
			@callback.calledWith(@error).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

	describe "when the request returns 404", ->
		beforeEach ->
			@request.callsArgWith(1, null, {statusCode: 404}, "")
			@PersistenceManager.setDocInWeb(@project_id, @doc_id, @lines, @callback)
			
		it "should return a NotFoundError", ->
			@callback.calledWith(new Errors.NotFoundError("not found")).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

	describe "when the request returns an error status code", ->
		beforeEach ->
			@request.callsArgWith(1, null, {statusCode: 500}, "")
			@PersistenceManager.setDocInWeb(@project_id, @doc_id, @lines, @callback)
			
		it "should return an error", ->
			@callback.calledWith(new Error("web api error")).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

