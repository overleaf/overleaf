SandboxedModule = require('sandboxed-module')
assert = require('assert')
chai = require('chai')
sinon = require('sinon')
sinonChai = require('sinon-chai')

chai.should()
chai.use(sinonChai)
expect = chai.expect

modulePath = '../../../../app/js/Features/Templates/TemplatesController'

describe "TemplatesController", ->

	beforeEach ->
		@user_id = "user-id"
		@TemplatesController = SandboxedModule.require modulePath, requires:
			"../../../js/Features/Authentication/AuthenticationController": @AuthenticationController = {
				getLoggedInUserId: sinon.stub().returns(@user_id)
			}
			"./TemplatesManager": @TemplatesManager = {
				createProjectFromV1Template: sinon.stub()
			}
		@next = sinon.stub()
		@req =
			body:
				brandVariationId: "brand-variation-id"
				compiler: "compiler"
				mainFile: "main-file"
				templateId: "template-id"
				templateName: "template-name"
				templateVersionId: "template-version-id"
			session:
				templateData: "template-data"
				user: _id: @user_id
		@res =
			redirect: sinon.stub()

	describe "createProjectFromV1Template", ->

		describe "on success", ->
			beforeEach ->
				@project =
					_id: "project-id"
				@TemplatesManager.createProjectFromV1Template.yields null, @project
				@TemplatesController.createProjectFromV1Template @req, @res, @next

			it "should call TemplatesManager", ->
				@TemplatesManager.createProjectFromV1Template.should.have.been.calledWithMatch "brand-variation-id", "compiler", "main-file", "template-id", "template-name", "template-version-id", "user-id"

			it "should redirect to project", ->
				@res.redirect.should.have.been.calledWith "/project/project-id"

			it "should delete session", ->
				expect(@req.session.templateData).to.be.undefined

		describe "on error", ->
			beforeEach ->
				@TemplatesManager.createProjectFromV1Template.yields "error"
				@TemplatesController.createProjectFromV1Template @req, @res, @next

			it "should call next with error", ->
				@next.should.have.been.calledWith "error"

			it "should not redirect", ->
				@res.redirect.called.should.equal false
