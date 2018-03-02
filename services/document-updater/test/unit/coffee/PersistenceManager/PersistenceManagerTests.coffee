sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/PersistenceManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors"

describe "PersistenceManager", ->
	beforeEach ->
		@request = sinon.stub()
		@request.defaults = () => @request
		@PersistenceManager = SandboxedModule.require modulePath, requires:
			"requestretry": @request
			"settings-sharelatex": @Settings = {}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
			"logger-sharelatex": @logger = {log: sinon.stub(), err: sinon.stub()}
		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@lines = ["one", "two", "three"]
		@version = 42
		@callback = sinon.stub()
		@ranges = { comments: "mock", entries: "mock" }
		@pathname = '/a/b/c.tex'
		@Settings.apis =
			web:
				url: @url = "www.example.com"
				user: @user = "sharelatex"
				pass: @pass = "password"

	describe "getDoc", ->
		beforeEach ->
			@webResponse = {
				lines: @lines,
				version: @version,
				ranges: @ranges
				pathname: @pathname,
			}

		describe "with a successful response from the web api", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 200}, JSON.stringify(@webResponse))
				@PersistenceManager.getDoc(@project_id, @doc_id, @callback)

			it "should call the web api", ->
				@request
					.calledWith({
						url: "#{@url}/project/#{@project_id}/doc/#{@doc_id}"
						method: "GET"
						headers:
							"accept": "application/json"
						auth:
							user: @user
							pass: @pass
							sendImmediately: true
						jar: false
						timeout: 5000
					})
					.should.equal true

			it "should call the callback with the doc lines, version and ranges", ->
				@callback.calledWith(null, @lines, @version, @ranges, @pathname).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when request returns an error", ->
			beforeEach ->
				@request.callsArgWith(1, @error = new Error("oops"), null, null)
				@PersistenceManager.getDoc(@project_id, @doc_id, @callback)

			it "should return the error", ->
				@callback.calledWith(@error).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the request returns 404", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 404}, "")
				@PersistenceManager.getDoc(@project_id, @doc_id, @callback)

			it "should return a NotFoundError", ->
				@callback.calledWith(new Errors.NotFoundError("not found")).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the request returns an error status code", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 500}, "")
				@PersistenceManager.getDoc(@project_id, @doc_id, @callback)

			it "should return an error", ->
				@callback.calledWith(new Error("web api error")).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when request returns an doc without lines", ->
			beforeEach ->
				delete @webResponse.lines
				@request.callsArgWith(1, null, {statusCode: 200}, JSON.stringify(@webResponse))
				@PersistenceManager.getDoc(@project_id, @doc_id, @callback)

			it "should return and error", ->
				@callback.calledWith(new Error("web API response had no doc lines")).should.equal true

		describe "when request returns an doc without a version", ->
			beforeEach ->
				delete @webResponse.version
				@request.callsArgWith(1, null, {statusCode: 200}, JSON.stringify(@webResponse))
				@PersistenceManager.getDoc(@project_id, @doc_id, @callback)

			it "should return and error", ->
				@callback.calledWith(new Error("web API response had no valid doc version")).should.equal true

		describe "when request returns an doc without a pathname", ->
			beforeEach ->
				delete @webResponse.pathname
				@request.callsArgWith(1, null, {statusCode: 200}, JSON.stringify(@webResponse))
				@PersistenceManager.getDoc(@project_id, @doc_id, @callback)

			it "should return and error", ->
				@callback.calledWith(new Error("web API response had no valid doc pathname")).should.equal true

	describe "setDoc", ->
		describe "with a successful response from the web api", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 200})
				@PersistenceManager.setDoc(@project_id, @doc_id, @lines, @version, @ranges, @callback)

			it "should call the web api", ->
				@request
					.calledWith({
						url: "#{@url}/project/#{@project_id}/doc/#{@doc_id}"
						json:
							lines: @lines
							version: @version
							ranges: @ranges
						method: "POST"
						auth:
							user: @user
							pass: @pass
							sendImmediately: true
						jar: false
						timeout: 5000
					})
					.should.equal true

			it "should call the callback without error", ->
				@callback.calledWith(null).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when request returns an error", ->
			beforeEach ->
				@request.callsArgWith(1, @error = new Error("oops"), null, null)
				@PersistenceManager.setDoc(@project_id, @doc_id, @lines, @version, @ranges, @callback)

			it "should return the error", ->
				@callback.calledWith(@error).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the request returns 404", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 404}, "")
				@PersistenceManager.setDoc(@project_id, @doc_id, @lines, @version, @ranges, @callback)

			it "should return a NotFoundError", ->
				@callback.calledWith(new Errors.NotFoundError("not found")).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the request returns an error status code", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 500}, "")
				@PersistenceManager.setDoc(@project_id, @doc_id, @lines, @version, @ranges, @callback)

			it "should return an error", ->
				@callback.calledWith(new Error("web api error")).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

