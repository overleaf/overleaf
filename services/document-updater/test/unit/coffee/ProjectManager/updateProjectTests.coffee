sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/ProjectManager.js"
SandboxedModule = require('sandboxed-module')
_ = require('lodash')

describe "ProjectManager", ->
	beforeEach ->
		@ProjectManager = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./ProjectHistoryRedisManager": @ProjectHistoryRedisManager = {}
			"./DocumentManager": @DocumentManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./HistoryManager": @HistoryManager = {}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()

		@project_id = "project-id-123"
		@projectHistoryId = 'history-id-123'
		@user_id = "user-id-123"
		@version = 1234567
		@HistoryManager.shouldFlushHistoryOps = sinon.stub().returns(false)
		@HistoryManager.flushProjectChangesAsync = sinon.stub()
		@callback = sinon.stub()

	describe "updateProjectWithLocks", ->
		describe "rename operations", ->
			beforeEach ->
				@firstDocUpdate =
					id: 1
					pathname: 'foo'
					newPathname: 'foo'
				@secondDocUpdate =
					id: 2
					pathname: 'bar'
					newPathname: 'bar2'
				@docUpdates = [ @firstDocUpdate, @secondDocUpdate ]
				@firstFileUpdate =
					id: 2
					pathname: 'bar'
					newPathname: 'bar2'
				@fileUpdates = [ @firstFileUpdate ]
				@DocumentManager.renameDocWithLock = sinon.stub().yields()
				@ProjectHistoryRedisManager.queueRenameEntity = sinon.stub().yields()

			describe "successfully", ->
				beforeEach ->
					@ProjectManager.updateProjectWithLocks @project_id, @projectHistoryId, @user_id, @docUpdates, @fileUpdates, @version, @callback

				it "should rename the docs in the updates", ->
					firstDocUpdateWithVersion = _.extend({}, @firstDocUpdate, {version: "#{@version}.0"})
					secondDocUpdateWithVersion = _.extend({}, @secondDocUpdate, {version: "#{@version}.1"})
					@DocumentManager.renameDocWithLock
						.calledWith(@project_id, @firstDocUpdate.id, @user_id, firstDocUpdateWithVersion, @projectHistoryId)
						.should.equal true
					@DocumentManager.renameDocWithLock
						.calledWith(@project_id, @secondDocUpdate.id, @user_id, secondDocUpdateWithVersion, @projectHistoryId)
						.should.equal true

				it "should rename the files in the updates", ->
					firstFileUpdateWithVersion = _.extend({}, @firstFileUpdate, {version: "#{@version}.2"})
					@ProjectHistoryRedisManager.queueRenameEntity
						.calledWith(@project_id, @projectHistoryId, 'file', @firstFileUpdate.id, @user_id, firstFileUpdateWithVersion)
						.should.equal true

				it "should not flush the history", ->
					@HistoryManager.flushProjectChangesAsync
						.calledWith(@project_id)
						.should.equal false

				it "should call the callback", ->
					@callback.called.should.equal true

			describe "when renaming a doc fails", ->
				beforeEach ->
					@error = new Error('error')
					@DocumentManager.renameDocWithLock = sinon.stub().yields(@error)
					@ProjectManager.updateProjectWithLocks @project_id, @projectHistoryId, @user_id, @docUpdates, @fileUpdates, @version, @callback

				it "should call the callback with the error", ->
					@callback.calledWith(@error).should.equal true

			describe "when renaming a file fails", ->
				beforeEach ->
					@error = new Error('error')
					@ProjectHistoryRedisManager.queueRenameEntity = sinon.stub().yields(@error)
					@ProjectManager.updateProjectWithLocks @project_id, @projectHistoryId, @user_id, @docUpdates, @fileUpdates, @version, @callback

				it "should call the callback with the error", ->
					@callback.calledWith(@error).should.equal true

			describe "with enough ops to flush", ->
				beforeEach ->
					@HistoryManager.shouldFlushHistoryOps = sinon.stub().returns(true)
					@ProjectManager.updateProjectWithLocks @project_id, @projectHistoryId, @user_id, @docUpdates, @fileUpdates, @version, @callback

				it "should flush the history", ->
					@HistoryManager.flushProjectChangesAsync
						.calledWith(@project_id)
						.should.equal true

		describe "add operations", ->
			beforeEach ->
				@firstDocUpdate =
					id: 1
					docLines: "a\nb"
				@secondDocUpdate =
					id: 2
					docLines: "a\nb"
				@docUpdates = [ @firstDocUpdate, @secondDocUpdate ]
				@firstFileUpdate =
					id: 3
					url: 'filestore.example.com/2'
				@secondFileUpdate =
					id: 4
					url: 'filestore.example.com/3'
				@fileUpdates = [ @firstFileUpdate, @secondFileUpdate ]
				@ProjectHistoryRedisManager.queueAddEntity = sinon.stub().yields()

			describe "successfully", ->
				beforeEach ->
					@ProjectManager.updateProjectWithLocks @project_id, @projectHistoryId, @user_id, @docUpdates, @fileUpdates, @version, @callback

				it "should add the docs in the updates", ->
					firstDocUpdateWithVersion = _.extend({}, @firstDocUpdate, {version: "#{@version}.0"})
					secondDocUpdateWithVersion = _.extend({}, @secondDocUpdate, {version: "#{@version}.1"})
					@ProjectHistoryRedisManager.queueAddEntity.getCall(0)
						.calledWith(@project_id, @projectHistoryId, 'doc', @firstDocUpdate.id, @user_id, firstDocUpdateWithVersion)
						.should.equal true
					@ProjectHistoryRedisManager.queueAddEntity.getCall(1)
						.calledWith(@project_id, @projectHistoryId, 'doc', @secondDocUpdate.id, @user_id, secondDocUpdateWithVersion)
						.should.equal true

				it "should add the files in the updates", ->
					firstFileUpdateWithVersion = _.extend({}, @firstFileUpdate, {version: "#{@version}.2"})
					secondFileUpdateWithVersion = _.extend({}, @secondFileUpdate, {version: "#{@version}.3"})
					@ProjectHistoryRedisManager.queueAddEntity.getCall(2)
						.calledWith(@project_id, @projectHistoryId, 'file', @firstFileUpdate.id, @user_id, firstFileUpdateWithVersion)
						.should.equal true
					@ProjectHistoryRedisManager.queueAddEntity.getCall(3)
						.calledWith(@project_id, @projectHistoryId, 'file', @secondFileUpdate.id, @user_id, secondFileUpdateWithVersion)
						.should.equal true

				it "should not flush the history", ->
					@HistoryManager.flushProjectChangesAsync
						.calledWith(@project_id)
						.should.equal false

				it "should call the callback", ->
					@callback.called.should.equal true

			describe "when adding a doc fails", ->
				beforeEach ->
					@error = new Error('error')
					@ProjectHistoryRedisManager.queueAddEntity = sinon.stub().yields(@error)
					@ProjectManager.updateProjectWithLocks @project_id, @projectHistoryId, @user_id, @docUpdates, @fileUpdates, @version, @callback

				it "should call the callback with the error", ->
					@callback.calledWith(@error).should.equal true

			describe "when adding a file fails", ->
				beforeEach ->
					@error = new Error('error')
					@ProjectHistoryRedisManager.queueAddEntity = sinon.stub().yields(@error)
					@ProjectManager.updateProjectWithLocks @project_id, @projectHistoryId, @user_id, @docUpdates, @fileUpdates, @version, @callback

				it "should call the callback with the error", ->
					@callback.calledWith(@error).should.equal true

			describe "with enough ops to flush", ->
				beforeEach ->
					@HistoryManager.shouldFlushHistoryOps = sinon.stub().returns(true)
					@ProjectManager.updateProjectWithLocks @project_id, @projectHistoryId, @user_id, @docUpdates, @fileUpdates, @version, @callback

				it "should flush the history", ->
					@HistoryManager.flushProjectChangesAsync
						.calledWith(@project_id)
						.should.equal true
