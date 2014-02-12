SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/Security/AuthorizationManager'
MockClient = require "../helpers/MockClient"

describe "AuthorizationManager", ->
	beforeEach ->
		@client = new MockClient()
		@AuthorizationManager = SandboxedModule.require modulePath, requires:
			'../../managers/SecurityManager':{}
	
	describe "ensureClientCanViewProject", ->
		beforeEach ->
			@client.set("project_id", "project-id")

		it "should let the request through for a readOnly privilege", (done) ->
			@client.set("privilege_level", "readOnly")
			@AuthorizationManager.ensureClientCanViewProject @client, done

		it "should let the request through for a readAndWrite privilege", (done) ->
			@client.set("privilege_level", "readAndWrite")
			@AuthorizationManager.ensureClientCanViewProject @client, done

		it "should let the request through for a owner privilege", (done) ->
			@client.set("privilege_level", "owner")
			@AuthorizationManager.ensureClientCanViewProject @client, done
	
		it "should ignore an empty privilege", ->
			@AuthorizationManager.ensureClientCanViewProject @client, () ->
				throw new Error("Should not be called")

	describe "ensureClientCanEditProject", ->
		beforeEach ->
			@client.set("project_id", "project-id")

		it "should ignore a readOnly privilege", ->
			@client.set("privilege_level", "readOnly")
			@AuthorizationManager.ensureClientCanEditProject @client, () ->
				throw new Error("Should not be called")

		it "should let the request through for a readAndWrite privilege", (done) ->
			@client.set("privilege_level", "readAndWrite")
			@AuthorizationManager.ensureClientCanEditProject @client, done

		it "should let the request through for a owner privilege", (done) ->
			@client.set("privilege_level", "owner")
			@AuthorizationManager.ensureClientCanEditProject @client, done
	
		it "should ignore an empty privilege", ->
			@AuthorizationManager.ensureClientCanEditProject @client, () ->
				throw new Error("Should not be called")

	describe "ensureClientCanAdminProject", ->
		beforeEach ->
			@client.set("project_id", "project-id")

		it "should ignore a readOnly privilege", ->
			@client.set("privilege_level", "readOnly")
			@AuthorizationManager.ensureClientCanAdminProject @client, () ->
				throw new Error("Should not be called")

		it "should ignore a readAndWrite privilege", ->
			@client.set("privilege_level", "readAndWrite")
			@AuthorizationManager.ensureClientCanAdminProject @client, () ->
				throw new Error("Should not be called")

		it "should let the request through for a owner privilege", (done) ->
			@client.set("privilege_level", "owner")
			@AuthorizationManager.ensureClientCanAdminProject @client, done
	
		it "should ignore an empty privilege", ->
			@AuthorizationManager.ensureClientCanAdminProject @client, () ->
				throw new Error("Should not be called")
	
	describe "ensureClientHasPrivilegeLevelForProject", ->
		it "should ignore callback if privilege_level is not set", ->
			@client.set("project_id", "project-id")
			@AuthorizationManager.ensureClientHasPrivilegeLevelForProject @client,
				["owner"], (error, project_id) ->
					throw new Error("Should not be called")

		it "should ignore callback if project_id is not set", ->
			@client.set("privilege_level", "owner")
			@AuthorizationManager.ensureClientHasPrivilegeLevelForProject @client,
				["owner"], (error, project_id) ->
					throw new Error("Should not be called")

		it "should return the project_id", (done) ->
			@client.set("privilege_level", "owner")
			@client.set("project_id", "project-id-123")
			@AuthorizationManager.ensureClientHasPrivilegeLevelForProject @client,
				["owner"], (error, project_id) ->
					project_id.should.equal "project-id-123"
					done()
			
