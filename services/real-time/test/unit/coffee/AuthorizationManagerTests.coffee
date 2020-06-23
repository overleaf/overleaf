chai = require "chai"
chai.should()
expect = chai.expect
sinon = require("sinon")
SandboxedModule = require('sandboxed-module')
path = require "path"
modulePath = '../../../app/js/AuthorizationManager'

describe 'AuthorizationManager', ->
	beforeEach ->
		@client =
			ol_context: {}

		@AuthorizationManager = SandboxedModule.require modulePath, requires: {}

	describe "assertClientCanViewProject", ->
		it "should allow the readOnly privilegeLevel", (done) ->
			@client.ol_context.privilege_level = "readOnly"
			@AuthorizationManager.assertClientCanViewProject @client, (error) ->
				expect(error).to.be.null
				done()

		it "should allow the readAndWrite privilegeLevel", (done) ->
			@client.ol_context.privilege_level = "readAndWrite"
			@AuthorizationManager.assertClientCanViewProject @client, (error) ->
				expect(error).to.be.null
				done()

		it "should allow the owner privilegeLevel", (done) ->
			@client.ol_context.privilege_level = "owner"
			@AuthorizationManager.assertClientCanViewProject @client, (error) ->
				expect(error).to.be.null
				done()

		it "should return an error with any other privilegeLevel", (done) ->
			@client.ol_context.privilege_level = "unknown"
			@AuthorizationManager.assertClientCanViewProject @client, (error) ->
				error.message.should.equal "not authorized"
				done()

	describe "assertClientCanEditProject", ->
		it "should not allow the readOnly privilegeLevel", (done) ->
			@client.ol_context.privilege_level = "readOnly"
			@AuthorizationManager.assertClientCanEditProject @client, (error) ->
				error.message.should.equal "not authorized"
				done()

		it "should allow the readAndWrite privilegeLevel", (done) ->
			@client.ol_context.privilege_level = "readAndWrite"
			@AuthorizationManager.assertClientCanEditProject @client, (error) ->
				expect(error).to.be.null
				done()

		it "should allow the owner privilegeLevel", (done) ->
			@client.ol_context.privilege_level = "owner"
			@AuthorizationManager.assertClientCanEditProject @client, (error) ->
				expect(error).to.be.null
				done()

		it "should return an error with any other privilegeLevel", (done) ->
			@client.ol_context.privilege_level = "unknown"
			@AuthorizationManager.assertClientCanEditProject @client, (error) ->
				error.message.should.equal "not authorized"
				done()

	# check doc access for project

	describe "assertClientCanViewProjectAndDoc", ->
		beforeEach () ->
			@doc_id = "12345"
			@callback = sinon.stub()
			@client.ol_context = {}

		describe "when not authorised at the project level", ->
			beforeEach () ->
				@client.ol_context.privilege_level = "unknown"

			it "should not allow access", () ->
				@AuthorizationManager.assertClientCanViewProjectAndDoc @client, @doc_id, (err) ->
					err.message.should.equal "not authorized"

			describe "even when authorised at the doc level", ->
				beforeEach (done) ->
					@AuthorizationManager.addAccessToDoc @client, @doc_id, done

				it "should not allow access", () ->
					@AuthorizationManager.assertClientCanViewProjectAndDoc @client, @doc_id, (err) ->
						err.message.should.equal "not authorized"

		describe "when authorised at the project level", ->
			beforeEach () ->
				@client.ol_context.privilege_level = "readOnly"

			describe "and not authorised at the document level", ->
				it "should not allow access", () ->
					@AuthorizationManager.assertClientCanViewProjectAndDoc @client, @doc_id, (err) ->
						err.message.should.equal "not authorized"

			describe "and authorised at the document level", ->
				beforeEach (done) ->
					@AuthorizationManager.addAccessToDoc @client, @doc_id, done

				it "should allow access", () ->
					@AuthorizationManager.assertClientCanViewProjectAndDoc @client, @doc_id, @callback
					@callback
						.calledWith(null)
						.should.equal true

			describe "when document authorisation is added and then removed", ->
				beforeEach (done) ->
					@AuthorizationManager.addAccessToDoc @client, @doc_id, () =>
						@AuthorizationManager.removeAccessToDoc @client, @doc_id, done

				it "should deny access", () ->
					@AuthorizationManager.assertClientCanViewProjectAndDoc @client, @doc_id, (err) ->
						err.message.should.equal "not authorized"

	describe "assertClientCanEditProjectAndDoc", ->
		beforeEach () ->
			@doc_id = "12345"
			@callback = sinon.stub()
			@client.ol_context = {}

		describe "when not authorised at the project level", ->
			beforeEach () ->
				@client.ol_context.privilege_level = "readOnly"

			it "should not allow access", () ->
				@AuthorizationManager.assertClientCanEditProjectAndDoc @client, @doc_id, (err) ->
					err.message.should.equal "not authorized"

			describe "even when authorised at the doc level", ->
				beforeEach (done) ->
					@AuthorizationManager.addAccessToDoc @client, @doc_id, done

				it "should not allow access", () ->
					@AuthorizationManager.assertClientCanEditProjectAndDoc @client, @doc_id, (err) ->
						err.message.should.equal "not authorized"

		describe "when authorised at the project level", ->
			beforeEach () ->
				@client.ol_context.privilege_level = "readAndWrite"

			describe "and not authorised at the document level", ->
				it "should not allow access", () ->
					@AuthorizationManager.assertClientCanEditProjectAndDoc @client, @doc_id, (err) ->
						err.message.should.equal "not authorized"

			describe "and authorised at the document level", ->
				beforeEach (done) ->
					@AuthorizationManager.addAccessToDoc @client, @doc_id, done

				it "should allow access", () ->
					@AuthorizationManager.assertClientCanEditProjectAndDoc @client, @doc_id, @callback
					@callback
						.calledWith(null)
						.should.equal true

			describe "when document authorisation is added and then removed", ->
				beforeEach (done) ->
					@AuthorizationManager.addAccessToDoc @client, @doc_id, () =>
						@AuthorizationManager.removeAccessToDoc @client, @doc_id, done

				it "should deny access", () ->
					@AuthorizationManager.assertClientCanEditProjectAndDoc @client, @doc_id, (err) ->
						err.message.should.equal "not authorized"
