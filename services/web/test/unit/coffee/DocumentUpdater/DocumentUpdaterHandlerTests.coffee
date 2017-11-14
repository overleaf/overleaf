should = require('chai').should()
spies = require('chai-spies')
chai = require('chai').use(spies)
sinon = require("sinon")
SandboxedModule = require('sandboxed-module')
assert = require('chai').assert
path = require 'path'
_ = require 'underscore'
ObjectId = require("mongojs").ObjectId;
modulePath = path.join __dirname, '../../../../app/js/Features/DocumentUpdater/DocumentUpdaterHandler'

describe 'DocumentUpdaterHandler', ->
	beforeEach ->
		@project_id = "project-id-923"
		@doc_id = "doc-id-394"
		@lines = ["one", "two", "three"]
		@version = 42
		@user_id = "mock-user-id-123"
		@project =
			_id: @project_id

		@request = {}
		@projectEntityHandler = {}
		@settings =
			apis:
				documentupdater:
					url : "http://document_updater.example.com"
				project_history:
					url: "http://project_history.example.com"

		@callback = sinon.stub()
		@handler = SandboxedModule.require modulePath, requires:
			'request': defaults:=> return @request
			'settings-sharelatex':@settings
			'logger-sharelatex':{log:(->), error:(->)}
			'../Project/ProjectEntityHandler':@projectEntityHandler
			"../../models/Project": Project: @Project={}
			'../../Features/Project/ProjectLocator':{}
			"metrics-sharelatex":
				Timer:->
					done:->

	describe 'flushProjectToMongo', ->
		describe "successfully", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
				@handler.flushProjectToMongo @project_id, @callback

			it 'should flush the document from the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}/flush"
				@request.post.calledWith(url).should.equal true

			it "should call the callback with no error", ->
				@callback.calledWith(null).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@handler.flushProjectToMongo @project_id, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@handler.flushProjectToMongo @project_id, @callback

			it "should return the callback with an error", ->
				@callback
					.calledWith(new Error("doc updater returned failure status code: 500"))
					.should.equal true

	describe 'flushProjectToMongoAndDelete', ->
		describe "successfully", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
				@handler.flushProjectToMongoAndDelete @project_id, @callback

			it 'should delete the project from the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}"
				@request.del.calledWith(url).should.equal true

			it "should call the callback with no error", ->
				@callback.calledWith(null).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@handler.flushProjectToMongoAndDelete @project_id, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@handler.flushProjectToMongoAndDelete @project_id, @callback

			it "should return the callback with an error", ->
				@callback
					.calledWith(new Error("doc updater returned failure status code: 500"))
					.should.equal true

	describe 'flushDocToMongo', ->
		describe "successfully", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
				@handler.flushDocToMongo @project_id, @doc_id, @callback

			it 'should flush the document from the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}/doc/#{@doc_id}/flush"
				@request.post.calledWith(url).should.equal true

			it "should call the callback with no error", ->
				@callback.calledWith(null).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@handler.flushDocToMongo @project_id, @doc_id, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@handler.flushDocToMongo @project_id, @doc_id, @callback

			it "should return the callback with an error", ->
				@callback
					.calledWith(new Error("doc updater returned failure status code: 500"))
					.should.equal true

	describe "deleteDoc", ->
		describe "successfully", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
				@handler.deleteDoc @project_id, @doc_id, @callback

			it 'should delete the document from the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}/doc/#{@doc_id}"
				@request.del.calledWith(url).should.equal true

			it "should call the callback with no error", ->
				@callback.calledWith(null).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@handler.deleteDoc @project_id, @doc_id, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@handler.deleteDoc @project_id, @doc_id, @callback

			it "should return the callback with an error", ->
				@callback
					.calledWith(new Error("doc updater returned failure status code: 500"))
					.should.equal true

	describe "setDocument", ->
		beforeEach ->
			@source = "dropbox"

		describe "successfully", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
				@handler.setDocument @project_id, @doc_id, @user_id, @lines, @source, @callback

			it 'should set the document in the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}/doc/#{@doc_id}"
				@request.post
					.calledWith({
						url: url
						json:
							lines: @lines
							source: @source
							user_id: @user_id
					})
					.should.equal true

			it "should call the callback with no error", ->
				@callback.calledWith(null).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@handler.setDocument @project_id, @doc_id, @user_id, @lines, @source, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@handler.setDocument @project_id, @doc_id, @user_id, @lines, @source, @callback

			it "should return the callback with an error", ->
				@callback
					.calledWith(new Error("doc updater returned failure status code: 500"))
					.should.equal true

	describe "getDocument", ->
		describe "successfully", ->
			beforeEach ->
				@body = JSON.stringify
					lines: @lines
					version: @version
					ops: @ops = ["mock-op-1", "mock-op-2"]
					ranges: @ranges = {"mock":"ranges"}
				@fromVersion = 2
				@request.get = sinon.stub().callsArgWith(1, null, {statusCode: 200}, @body)
				@handler.getDocument @project_id, @doc_id, @fromVersion, @callback

			it 'should get the document from the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}/doc/#{@doc_id}?fromVersion=#{@fromVersion}"
				@request.get.calledWith(url).should.equal true

			it "should call the callback with the lines and version", ->
				@callback.calledWith(null, @lines, @version, @ranges, @ops).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@handler.getDocument @project_id, @doc_id, @fromVersion, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@handler.getDocument @project_id, @doc_id, @fromVersion, @callback

			it "should return the callback with an error", ->
				@callback
					.calledWith(new Error("doc updater returned failure status code: 500"))
					.should.equal true

	describe "getProjectDocsIfMatch", ->
		beforeEach ->
			@project_state_hash = "1234567890abcdef"

		describe "successfully", ->
			beforeEach ->
				@doc0 =
					_id: @doc_id
					lines: @lines
					v: @version
				@docs = [ @doc0, @doc0, @doc0 ]
				@body = JSON.stringify @docs
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 200}, @body)
				@handler.getProjectDocsIfMatch @project_id, @project_state_hash, @callback

			it 'should get the documenst from the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}/get_and_flush_if_old?state=#{@project_state_hash}"
				@request.post.calledWith(url).should.equal true

			it "should call the callback with the documents", ->
				@callback.calledWithExactly(null, @docs).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@handler.getProjectDocsIfMatch @project_id, @project_state_hash, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a conflict error code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, { statusCode: 409 }, "Conflict")
				@handler.getProjectDocsIfMatch @project_id, @project_state_hash, @callback

			it "should return the callback with no documents", ->
				@callback
					.alwaysCalledWithExactly()
					.should.equal true


	describe "clearProjectState", ->
		describe "successfully", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 200})
				@handler.clearProjectState @project_id, @callback

			it 'should clear the project state from the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}/clearState"
				@request.post.calledWith(url).should.equal true

			it "should call the callback", ->
				@callback.calledWithExactly().should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@handler.getProjectDocsIfMatch @project_id, @project_state_hash, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a conflict error code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, { statusCode: 409 }, "Conflict")
				@handler.getProjectDocsIfMatch @project_id, @project_state_hash, @callback

			it "should return the callback with no documents", ->
				@callback
					.alwaysCalledWithExactly()
					.should.equal true


	describe "acceptChanges", ->
		beforeEach ->
			@change_id = "mock-change-id-1"

		describe "successfully", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 200}, @body)
				@handler.acceptChanges @project_id, @doc_id, [ @change_id ], @callback

			it 'should accept the change in the document updater', ->
				req =
					url: "#{@settings.apis.documentupdater.url}/project/#{@project_id}/doc/#{@doc_id}/change/accept"
					json:
						change_ids: [ @change_id ]
				@request.post.calledWith(req).should.equal true

			it "should call the callback", ->
				@callback.calledWith(null).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@handler.acceptChanges @project_id, @doc_id, [ @change_id ], @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@handler.acceptChanges @project_id, @doc_id, [ @change_id ], @callback

			it "should return the callback with an error", ->
				@callback
					.calledWith(new Error("doc updater returned failure status code: 500"))
					.should.equal true

	describe "deleteThread", ->
		beforeEach ->
			@thread_id = "mock-thread-id-1"

		describe "successfully", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, {statusCode: 200}, @body)
				@handler.deleteThread @project_id, @doc_id, @thread_id, @callback

			it 'should delete the thread in the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}/doc/#{@doc_id}/comment/#{@thread_id}"
				@request.del.calledWith(url).should.equal true

			it "should call the callback", ->
				@callback.calledWith(null).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@handler.deleteThread @project_id, @doc_id, @thread_id, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@handler.deleteThread @project_id, @doc_id, @thread_id, @callback

			it "should return the callback with an error", ->
				@callback
					.calledWith(new Error("doc updater returned failure status code: 500"))
					.should.equal true

	describe "updateProjectStructure ", ->
		beforeEach ->
			@user_id = 1234

		describe "with project history disabled", ->
			beforeEach ->
				@settings.apis.project_history.enabled = false
				@request.post = sinon.stub()

				@handler.updateProjectStructure @project_id, @user_id, @oldDocs, @newDocs, @oldFiles, @newFiles, @callback

			it 'does not make a web request', ->
				@request.post.called.should.equal false

			it 'calls the callback', ->
				@callback.called.should.equal true

		describe "with project history enabled", ->
			beforeEach ->
				@settings.apis.project_history.enabled = true
				@url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}"
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")

			describe "when an entity has changed name", ->
				it 'should send the structure update to the document updater', (done) ->
					@docIdA = new ObjectId()
					@docIdB = new ObjectId()
					@oldDocs = [
						{ path: '/old_a', doc: _id: @docIdA }
						{ path: '/old_b', doc: _id: @docIdB }
					]
					# create new instances of the same ObjectIds so that == doens't pass
					@newDocs = [
						{ path: '/old_a', doc: _id: new ObjectId(@docIdA.toString()) }
						{ path: '/new_b', doc: _id: new ObjectId(@docIdB.toString()) }
					]
					@oldFiles = []
					@newFiles = []

					docUpdates = [
						id: @docIdB.toString(),
						pathname: "/old_b"
						newPathname: "/new_b"
					]

					@handler.updateProjectStructure @project_id, @user_id, @oldDocs, @newDocs, @oldFiles, @newFiles, () =>
						@request.post
							.calledWith(url: @url, json: {docUpdates, fileUpdates: [], userId: @user_id})
							.should.equal true
						done()

			describe "when a doc has been added", ->
				it 'should send the structure update to the document updater', (done) ->
					@docId = new ObjectId()
					@oldDocs = []
					@newDocs = [
						{ path: '/foo', docLines: 'a\nb', doc: _id: @docId }
					]
					@oldFiles = []
					@newFiles = []

					docUpdates = [
						id: @docId.toString(),
						pathname: "/foo"
						docLines: 'a\nb'
						url: undefined
					]

					@handler.updateProjectStructure @project_id, @user_id, @oldDocs, @newDocs, @oldFiles, @newFiles, () =>
						@request.post
							.calledWith(url: @url, json: {docUpdates, fileUpdates: [], userId: @user_id})
							.should.equal true
						done()

			describe "when a file has been added", ->
				it 'should send the structure update to the document updater', (done) ->
					@fileId = new ObjectId()
					@oldDocs = []
					@newDocs = []
					@oldFiles = []
					@newFiles = [
						{ path: '/bar', url: 'filestore.example.com/file', file: _id: @fileId }
					]

					fileUpdates = [
						id: @fileId.toString(),
						pathname: "/bar"
						url: 'filestore.example.com/file'
						docLines: undefined
					]

					@handler.updateProjectStructure @project_id, @user_id, @oldDocs, @newDocs, @oldFiles, @newFiles, () =>
						@request.post
							.calledWith(url: @url, json: {docUpdates: [], fileUpdates, userId: @user_id})
							.should.equal true
						done()
