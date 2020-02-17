sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/RestoreManager.js"
SandboxedModule = require('sandboxed-module')

describe "RestoreManager", ->
	beforeEach ->
		@RestoreManager = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./DocumentUpdaterManager": @DocumentUpdaterManager = {}
			"./DiffManager": @DiffManager = {}
		@callback = sinon.stub()
		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"
		@user_id = "mock-user-id"
		@version = 42

	describe "restoreToBeforeVersion", ->
		beforeEach ->
			@content = "mock content"
			@DocumentUpdaterManager.setDocument = sinon.stub().callsArg(4)
			@DiffManager.getDocumentBeforeVersion = sinon.stub().callsArgWith(3, null, @content)
			@RestoreManager.restoreToBeforeVersion @project_id, @doc_id, @version, @user_id, @callback

		it "should get the content before the requested version", ->
			@DiffManager.getDocumentBeforeVersion
				.calledWith(@project_id, @doc_id, @version)
				.should.equal true

		it "should set the document in the document updater", ->
			@DocumentUpdaterManager.setDocument
				.calledWith(@project_id, @doc_id, @content, @user_id)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
			