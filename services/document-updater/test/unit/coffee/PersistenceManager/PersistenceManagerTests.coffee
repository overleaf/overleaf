sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/PersistenceManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors"

describe "PersistenceManager", ->
	beforeEach ->
		@PersistenceManager = SandboxedModule.require modulePath, requires:
			"request": @request = sinon.stub()
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
		@track_changes_entries = { comments: "mock", entries: "mock" }
		@Settings.apis =
			web:
				url: @url = "www.example.com"
				user: @user = "sharelatex"
				pass: @pass = "password"

	describe "getDoc", ->
	
		describe "with a successful response from the web api", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 200}, JSON.stringify({
					lines: @lines,
					version: @version,
					track_changes_entries: @track_changes_entries
				}))
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

			it "should call the callback with the doc lines, version and track changes state", ->
				@callback.calledWith(null, @lines, @version, @track_changes_entries).should.equal true

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
				@request.callsArgWith(1, null, {statusCode: 200}, JSON.stringify(version: @version))
				@PersistenceManager.getDoc(@project_id, @doc_id, @callback)

			it "should return and error", ->
				@callback.calledWith(new Error("web API response had no doc lines")).should.equal true

		describe "when request returns an doc without a version", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 200}, JSON.stringify(lines: @lines))
				@PersistenceManager.getDoc(@project_id, @doc_id, @callback)

			it "should return and error", ->
				@callback.calledWith(new Error("web API response had no valid doc version")).should.equal true

	describe "setDoc", ->
		describe "with a successful response from the web api", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 200})
				@PersistenceManager.setDoc(@project_id, @doc_id, @lines, @version, @track_changes_entries, @callback)

			it "should call the web api", ->
				@request
					.calledWith({
						url: "#{@url}/project/#{@project_id}/doc/#{@doc_id}"
						json:
							lines: @lines
							version: @version
							track_changes_entries: @track_changes_entries
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
				@PersistenceManager.setDoc(@project_id, @doc_id, @lines, @version, @track_changes_entries, @callback)

			it "should return the error", ->
				@callback.calledWith(@error).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the request returns 404", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 404}, "")
				@PersistenceManager.setDoc(@project_id, @doc_id, @lines, @version, @track_changes_entries, @callback)
				
			it "should return a NotFoundError", ->
				@callback.calledWith(new Errors.NotFoundError("not found")).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the request returns an error status code", ->
			beforeEach ->
				@request.callsArgWith(1, null, {statusCode: 500}, "")
				@PersistenceManager.setDoc(@project_id, @doc_id, @lines, @version, @track_changes_entries, @callback)
				
			it "should return an error", ->
				@callback.calledWith(new Error("web api error")).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

