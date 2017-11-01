sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/ProjectManager.js"
SandboxedModule = require('sandboxed-module')

describe "ProjectManager", ->
	beforeEach ->
		@ProjectManager = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./DocumentManager": @DocumentManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()

		@project_id = "project-id-123"
		@user_id = "user-id-123"
		@callback = sinon.stub()

	describe "updateProjectWithLocks", ->
		beforeEach ->
			@firstUpdate =
				id: 1
				update: 'foo'
			@secondUpdate =
				id: 2
				update: 'bar'
			@updates = [ @firstUpdate, @secondUpdate ]

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.renameDocWithLock = sinon.stub().yields()
				@ProjectManager.updateProjectWithLocks @project_id, @user_id, @updates, @callback

			it "should rename the documents in the updates", ->
				@DocumentManager.renameDocWithLock
					.calledWith(@project_id, @firstUpdate.id, @user_id, @firstUpdate)
					.should.equal true
				@DocumentManager.renameDocWithLock
					.calledWith(@project_id, @secondUpdate.id, @user_id, @secondUpdate)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when renaming a doc fails", ->
			beforeEach ->
				@error = new Error('error')
				@DocumentManager.renameDocWithLock = sinon.stub().yields(@error)
				@ProjectManager.updateProjectWithLocks @project_id, @user_id, @updates, @callback

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true
