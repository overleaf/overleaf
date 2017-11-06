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
			@firstDocUpdate =
				id: 1
				update: 'foo'
			@secondDocUpdate =
				id: 2
				update: 'bar'
			@docUpdates = [ @firstDocUpdate, @secondDocUpdate ]
			@firstFileUpdate =
				id: 2
				update: 'bar'
			@fileUpdates = [ @firstFileUpdate ]
			@DocumentManager.renameDocWithLock = sinon.stub().yields()
			@RedisManager.renameFile = sinon.stub().yields()

		describe "successfully", ->
			beforeEach ->
				@ProjectManager.updateProjectWithLocks @project_id, @user_id, @docUpdates, @fileUpdates, @callback

			it "should rename the docs in the updates", ->
				@DocumentManager.renameDocWithLock
					.calledWith(@project_id, @firstDocUpdate.id, @user_id, @firstDocUpdate)
					.should.equal true
				@DocumentManager.renameDocWithLock
					.calledWith(@project_id, @secondDocUpdate.id, @user_id, @secondDocUpdate)
					.should.equal true

			it "should rename the files in the updates", ->
				@RedisManager.renameFile
					.calledWith(@project_id, @firstFileUpdate.id, @user_id, @firstFileUpdate)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when renaming a doc fails", ->
			beforeEach ->
				@error = new Error('error')
				@DocumentManager.renameDocWithLock = sinon.stub().yields(@error)
				@ProjectManager.updateProjectWithLocks @project_id, @user_id, @docUpdates, @fileUpdates, @callback

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true

		describe "when renaming a file fails", ->
			beforeEach ->
				@error = new Error('error')
				@RedisManager.renameFile = sinon.stub().yields(@error)
				@ProjectManager.updateProjectWithLocks @project_id, @user_id, @docUpdates, @fileUpdates, @callback

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true
