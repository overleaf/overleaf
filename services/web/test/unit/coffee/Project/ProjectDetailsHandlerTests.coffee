should = require('chai').should()
modulePath = "../../../../app/js/Features/Project/ProjectDetailsHandler"
Errors = require "../../../../app/js/Features/Errors/Errors"
SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
assert = require("chai").assert
expect = require("chai").expect
require('chai').should()

describe 'ProjectDetailsHandler', ->

	beforeEach ->
		@project_id = "321l3j1kjkjl"
		@user_id = "user-id-123"
		@project =
			name: "project"
			description: "this is a great project"
			something:"should not exist"
			compiler: "latexxxxxx"
			owner_ref: @user_id
		@user =
			features: "mock-features"
		@ProjectGetter =
			getProjectWithoutDocLines: sinon.stub().callsArgWith(1, null, @project)
			getProject: sinon.stub().callsArgWith(2, null, @project)
		@ProjectModel =
			update: sinon.stub()
			findOne: sinon.stub()
		@UserGetter =
			getUser: sinon.stub().callsArgWith(1, null, @user)
		@tpdsUpdateSender =
			moveEntity:sinon.stub().callsArgWith 1
		@ProjectEntityHandler =
			flushProjectToThirdPartyDataStore: sinon.stub().callsArg(1)
		@handler = SandboxedModule.require modulePath, requires:
			"./ProjectGetter":@ProjectGetter
			'../../models/Project': Project:@ProjectModel
			"../User/UserGetter": @UserGetter
			'../ThirdPartyDataStore/TpdsUpdateSender':@tpdsUpdateSender
			"./ProjectEntityHandler": @ProjectEntityHandler
			'logger-sharelatex':
				log:->
				err:->
			'./ProjectTokenGenerator': @ProjectTokenGenerator = {}
			'settings-sharelatex': @settings =
				defaultFeatures: 'default-features'

	describe "getDetails", ->

		it "should find the project and owner", (done)->
			@handler.getDetails @project_id, (err, details)=>
				details.name.should.equal @project.name
				details.description.should.equal @project.description
				details.compiler.should.equal @project.compiler
				details.features.should.equal @user.features
				assert.equal(details.something, undefined)
				done()

		it "should find overleaf metadata if it exists", (done)->
			@project.overleaf = { id: 'id' }
			@handler.getDetails @project_id, (err, details)=>
				details.overleaf.should.equal @project.overleaf
				assert.equal(details.something, undefined)
				done()

		it "should return an error for a non-existent project", (done)->
			@ProjectGetter.getProject.callsArg(2, null, null)
			err = new Errors.NotFoundError("project not found")
			@handler.getDetails "0123456789012345678901234", (error, details) =>
				err.should.eql error
				done()

		it 'should return the default features if no owner found', (done) ->
			@UserGetter.getUser.callsArgWith(1, null, null)
			@handler.getDetails @project_id, (err, details)=>
				details.features.should.equal @settings.defaultFeatures
				done()

		it "should return the error", (done)->
			error = "some error"
			@ProjectGetter.getProject.callsArgWith(2, error)
			@handler.getDetails @project_id, (err)=>
				err.should.equal error
				done()

	describe "transferOwnership", ->
		it "should return a not found error if the project can't be found", (done) ->
			@ProjectGetter.getProject.callsArgWith(2)
			@handler.transferOwnership 'abc', '123', (err) ->
				err.should.exist
				err.name.should.equal "NotFoundError"
				done()

		it "should return a not found error if the user can't be found", (done) ->
			@ProjectGetter.getProject.callsArgWith(2)
			@handler.transferOwnership 'abc', '123', (err) ->
				err.should.exist
				err.name.should.equal "NotFoundError"
				done()

		it "should transfer ownership of the project", (done) ->
			@ProjectModel.update.callsArgWith(2)
			@handler.transferOwnership 'abc', '123', () =>
				sinon.assert.calledWith(@ProjectModel.update, {_id: 'abc'})
				done()

		it "should flush the project to tpds", (done) ->
			@ProjectModel.update.callsArgWith(2)
			@handler.transferOwnership 'abc', '123', () =>
				sinon.assert.calledWith(@ProjectEntityHandler.flushProjectToThirdPartyDataStore, 'abc')
				done()


	describe "getProjectDescription", ->

		it "should make a call to mongo just for the description", (done)->
			@ProjectGetter.getProject.callsArgWith(2)
			@handler.getProjectDescription @project_id, (err, description)=>
				@ProjectGetter.getProject
					.calledWith(@project_id, description: true)
					.should.equal true
				done()

		it "should return what the mongo call returns", (done)->
			err = "error"
			description = "cool project"
			@ProjectGetter.getProject.callsArgWith(2, err, {description:description})
			@handler.getProjectDescription @project_id, (returnedErr, returnedDescription)=>
				err.should.equal returnedErr
				description.should.equal returnedDescription
				done()

	describe "setProjectDescription", ->

		beforeEach ->
			@description = "updated teh description"

		it "should update the project detials", (done)->
			@ProjectModel.update.callsArgWith(2)
			@handler.setProjectDescription @project_id, @description, =>
				@ProjectModel.update.calledWith({_id:@project_id}, {description:@description}).should.equal true
				done()

	describe "renameProject", ->
		beforeEach ->
			@handler.validateProjectName = sinon.stub().yields()
			@ProjectModel.update.callsArgWith(2)
			@newName = "new name here"

		it "should update the project with the new name", (done)->
			newName = "new name here"
			@handler.renameProject @project_id, @newName, =>
				@ProjectModel.update.calledWith({_id: @project_id}, {name: @newName}).should.equal true
				done()

		it "should tell the tpdsUpdateSender", (done)->
			@handler.renameProject @project_id, @newName, =>
				@tpdsUpdateSender.moveEntity.calledWith({project_id:@project_id, project_name:@project.name, newProjectName:@newName}).should.equal true
				done()

		it "should not do anything with an invalid name", (done) ->
			@handler.validateProjectName = sinon.stub().yields(new Error("invalid name"))
			@handler.renameProject @project_id, @newName, =>
				@tpdsUpdateSender.moveEntity.called.should.equal false
				@ProjectModel.update.called.should.equal false
				done()

	describe "validateProjectName", ->

		it "should reject undefined names", (done) ->
			@handler.validateProjectName undefined, (error) ->
				expect(error).to.exist
				done()

		it "should reject empty names", (done) ->
			@handler.validateProjectName "", (error) ->
				expect(error).to.exist
				done()

		it "should reject names with /s", (done) ->
			@handler.validateProjectName "foo/bar", (error) ->
				expect(error).to.exist
				done()

		it "should reject names with \\s", (done) ->
			@handler.validateProjectName "foo\\bar", (error) ->
				expect(error).to.exist
				done()

		it "should reject long names", (done) ->
			@handler.validateProjectName new Array(1000).join("a"), (error) ->
				expect(error).to.exist
				done()

		it "should accept normal names", (done) ->
			@handler.validateProjectName "foobar", (error) ->
				expect(error).to.not.exist
				done()

	describe "ensureProjectNameIsUnique", ->
		beforeEach ->
			@result = {
				owned: [{_id: 1, name:"name"}, {_id: 2, name: "name1"}, {_id: 3, name: "name11"}, {_id: 100, name: "numeric"}]
				readAndWrite: [{_id: 4, name:"name2"}, {_id: 5, name:"name22"}]
				readOnly: [{_id:6, name:"name3"}, {_id:7, name: "name33"}]
				tokenReadAndWrite: [{_id:8, name:"name4"}, {_id:9, name:"name44"}]
				tokenReadOnly: [{_id:10, name:"name5"}, {_id:11, name:"name55"}, {_id:12, name:"x".repeat(15)}]
			}
			for i in [1..20].concat([30..40])
				@result.owned.push {_id: 100 + i, name: "numeric (#{i})"}
			@ProjectGetter.findAllUsersProjects = sinon.stub().callsArgWith(2, null, @result)

		it "should leave a unique name unchanged", (done) ->
			@handler.ensureProjectNameIsUnique @user_id, "unique-name", ["-test-suffix"], (error, name, changed) ->
				expect(name).to.equal "unique-name"
				expect(changed).to.equal false
				done()

		it "should append a suffix to an existing name", (done) ->
			@handler.ensureProjectNameIsUnique @user_id, "name1", ["-test-suffix"], (error, name, changed) ->
				expect(name).to.equal "name1-test-suffix"
				expect(changed).to.equal true
				done()

		it "should fallback to a second suffix when needed", (done) ->
			@handler.ensureProjectNameIsUnique @user_id, "name1", ["1", "-test-suffix"], (error, name, changed) ->
				expect(name).to.equal "name1-test-suffix"
				expect(changed).to.equal true
				done()

		it "should truncate the name when append a suffix if the result is too long", (done) ->
			@handler.MAX_PROJECT_NAME_LENGTH = 20
			@handler.ensureProjectNameIsUnique @user_id, "x".repeat(15), ["-test-suffix"], (error, name, changed) ->
				expect(name).to.equal "x".repeat(8) + "-test-suffix"
				expect(changed).to.equal true
				done()

		it "should use a numeric index if no suffix is supplied", (done) ->
			@handler.ensureProjectNameIsUnique @user_id, "name1", [], (error, name, changed) ->
				expect(name).to.equal "name1 (1)"
				expect(changed).to.equal true
				done()

		it "should use a numeric index if all suffixes are exhausted", (done) ->
			@handler.ensureProjectNameIsUnique @user_id, "name", ["1", "11"], (error, name, changed) ->
				expect(name).to.equal "name (1)"
				expect(changed).to.equal true
				done()

		it "should find the next lowest available numeric index for the base name", (done) ->
			@handler.ensureProjectNameIsUnique @user_id, "numeric", [], (error, name, changed) ->
				expect(name).to.equal "numeric (21)"
				expect(changed).to.equal true
				done()

		it "should find the next available numeric index when a numeric index is already present", (done) ->
			@handler.ensureProjectNameIsUnique @user_id, "numeric (5)", [], (error, name, changed) ->
				expect(name).to.equal "numeric (21)"
				expect(changed).to.equal true
				done()

		it "should not find a numeric index lower than the one already present", (done) ->
			@handler.ensureProjectNameIsUnique @user_id, "numeric (31)", [], (error, name, changed) ->
				expect(name).to.equal "numeric (41)"
				expect(changed).to.equal true
				done()

	describe "fixProjectName", ->

		it "should change empty names to Untitled", () ->
			expect(@handler.fixProjectName "").to.equal "Untitled"

		it "should replace / with -", () ->
			expect(@handler.fixProjectName "foo/bar").to.equal "foo-bar"

		it "should replace \\ with ''", () ->
			expect(@handler.fixProjectName "foo \\ bar").to.equal "foo  bar"

		it "should truncate long names", () ->
			expect(@handler.fixProjectName new Array(1000).join("a")).to.equal "a".repeat(150)

		it "should accept normal names", () ->
			expect(@handler.fixProjectName "foobar").to.equal "foobar"


	describe "setPublicAccessLevel", ->
		beforeEach ->
			@ProjectModel.update.callsArgWith(2)
			@accessLevel = "readOnly"

		it "should update the project with the new level", (done)->
			@handler.setPublicAccessLevel @project_id, @accessLevel, =>
				@ProjectModel.update.calledWith({_id: @project_id}, {publicAccesLevel: @accessLevel}).should.equal true
				done()

		it 'should not produce an error', (done) ->
			@handler.setPublicAccessLevel @project_id, @accessLevel, (err) =>
				expect(err).to.not.exist
				done()

		describe 'when update produces an error', ->
			beforeEach ->
				@ProjectModel.update.callsArgWith(2, new Error('woops'))

			it 'should produce an error', (done) ->
				@handler.setPublicAccessLevel @project_id, @accessLevel, (err) =>
					expect(err).to.exist
					expect(err).to.be.instanceof Error
					done()

	describe "ensureTokensArePresent", ->
		beforeEach ->

		describe 'when the project has tokens', ->
			beforeEach ->
				@project =
					_id: @project_id
					tokens:
						readOnly: 'aaa'
						readAndWrite: '42bbb'
						readAndWritePrefix: '42'
				@ProjectGetter.getProject = sinon.stub()
					.callsArgWith(2, null, @project)
				@ProjectModel.update = sinon.stub()

			it 'should get the project', (done) ->
				@handler.ensureTokensArePresent @project_id, (err, tokens) =>
					expect(@ProjectGetter.getProject.callCount).to.equal 1
					expect(@ProjectGetter.getProject.calledWith(@project_id, {tokens: 1}))
						.to.equal true
					done()

			it 'should not update the project with new tokens', (done) ->
				@handler.ensureTokensArePresent @project_id, (err, tokens) =>
					expect(@ProjectModel.update.callCount).to.equal 0
					done()

			it 'should produce the tokens without error', (done) ->
				@handler.ensureTokensArePresent @project_id, (err, tokens) =>
					expect(err).to.not.exist
					expect(tokens).to.deep.equal @project.tokens
					done()

		describe 'when tokens are missing', ->
			beforeEach ->
				@project =
					_id: @project_id
				@ProjectGetter.getProject = sinon.stub()
					.callsArgWith(2, null, @project)
				@readOnlyToken = 'abc'
				@readAndWriteToken = '42def'
				@readAndWriteTokenPrefix = '42'
				@ProjectTokenGenerator.generateUniqueReadOnlyToken = sinon.stub().callsArgWith(0, null, @readOnlyToken)
				@ProjectTokenGenerator.readAndWriteToken = sinon.stub().returns({
					token: @readAndWriteToken
					numericPrefix:  @readAndWriteTokenPrefix
				})
				@ProjectModel.update = sinon.stub()
					.callsArgWith(2, null)

			it 'should get the project', (done) ->
				@handler.ensureTokensArePresent @project_id, (err, tokens) =>
					expect(@ProjectGetter.getProject.callCount).to.equal 1
					expect(@ProjectGetter.getProject.calledWith(@project_id, {tokens: 1}))
						.to.equal true
					done()

			it 'should update the project with new tokens', (done) ->
				@handler.ensureTokensArePresent @project_id, (err, tokens) =>
					expect(@ProjectTokenGenerator.generateUniqueReadOnlyToken.callCount)
						.to.equal 1
					expect(@ProjectTokenGenerator.readAndWriteToken.callCount)
						.to.equal 1
					expect(@ProjectModel.update.callCount).to.equal 1
					expect(@ProjectModel.update.calledWith(
						{_id: @project_id},
						{
							$set: {
								tokens: {
									readOnly: @readOnlyToken,
									readAndWrite: @readAndWriteToken,
									readAndWritePrefix: @readAndWriteTokenPrefix
								}
							}
						}
					)).to.equal true
					done()

			it 'should produce the tokens without error', (done) ->
				@handler.ensureTokensArePresent @project_id, (err, tokens) =>
					expect(err).to.not.exist
					expect(tokens).to.deep.equal {
						readOnly: @readOnlyToken,
						readAndWrite: @readAndWriteToken,
						readAndWritePrefix: @readAndWriteTokenPrefix
					}
					done()
