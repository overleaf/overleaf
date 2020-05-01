sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/HttpController.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors.js"

describe "HttpController", ->
	beforeEach ->
		@HttpController = SandboxedModule.require modulePath, requires:
			"./DocumentManager": @DocumentManager = {}
			"./HistoryManager": @HistoryManager =
				flushProjectChangesAsync: sinon.stub()
			"./ProjectManager": @ProjectManager = {}
			"logger-sharelatex" : @logger = { log: sinon.stub() }
			"./ProjectFlusher": {flushAllProjects:->}
			"./DeleteQueueManager": @DeleteQueueManager = {}
			"./Metrics": @Metrics = {}
			"./Errors" : Errors
		@Metrics.Timer = class Timer
			done: sinon.stub()
		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@next = sinon.stub()
		@res =
			send: sinon.stub()
			sendStatus: sinon.stub()
			json: sinon.stub()

	describe "getDoc", ->
		beforeEach ->
			@lines = ["one", "two", "three"]
			@ops = ["mock-op-1", "mock-op-2"]
			@version = 42
			@fromVersion = 42
			@ranges = { changes: "mock", comments: "mock" }
			@pathname = '/a/b/c'
			@req =
				params:
					project_id: @project_id
					doc_id: @doc_id

		describe "when the document exists and no recent ops are requested", ->
			beforeEach ->
				@DocumentManager.getDocAndRecentOpsWithLock = sinon.stub().callsArgWith(3, null, @lines, @version, [], @ranges, @pathname)
				@HttpController.getDoc(@req, @res, @next)

			it "should get the doc", ->
				@DocumentManager.getDocAndRecentOpsWithLock
					.calledWith(@project_id, @doc_id, -1)
					.should.equal true

			it "should return the doc as JSON", ->
				@res.json
					.calledWith({
						id: @doc_id
						lines: @lines
						version: @version
						ops: []
						ranges: @ranges
						pathname: @pathname
					})
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith(doc_id: @doc_id, project_id: @project_id, "getting doc via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when recent ops are requested", ->
			beforeEach ->
				@DocumentManager.getDocAndRecentOpsWithLock = sinon.stub().callsArgWith(3, null, @lines, @version, @ops, @ranges, @pathname)
				@req.query = fromVersion: "#{@fromVersion}"
				@HttpController.getDoc(@req, @res, @next)

			it "should get the doc", ->
				@DocumentManager.getDocAndRecentOpsWithLock
					.calledWith(@project_id, @doc_id, @fromVersion)
					.should.equal true

			it "should return the doc as JSON", ->
				@res.json
					.calledWith({
						id: @doc_id
						lines: @lines
						version: @version
						ops: @ops
						ranges: @ranges
						pathname: @pathname
					})
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith(doc_id: @doc_id, project_id: @project_id, "getting doc via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the document does not exist", ->
			beforeEach ->
				@DocumentManager.getDocAndRecentOpsWithLock = sinon.stub().callsArgWith(3, null, null, null)
				@HttpController.getDoc(@req, @res, @next)

			it "should call next with NotFoundError", ->
				@next
					.calledWith(new Errors.NotFoundError("not found"))
					.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@DocumentManager.getDocAndRecentOpsWithLock = sinon.stub().callsArgWith(3, new Error("oops"), null, null)
				@HttpController.getDoc(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true

	describe "setDoc", ->
		beforeEach ->
			@lines = ["one", "two", "three"]
			@source = "dropbox"
			@user_id = "user-id-123"
			@req =
				headers: {}
				params:
					project_id: @project_id
					doc_id: @doc_id
				body:
					lines: @lines
					source: @source
					user_id: @user_id
					undoing: @undoing = true

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.setDocWithLock = sinon.stub().callsArgWith(6)
				@HttpController.setDoc(@req, @res, @next)

			it "should set the doc", ->
				@DocumentManager.setDocWithLock
					.calledWith(@project_id, @doc_id, @lines, @source, @user_id, @undoing)
					.should.equal true

			it "should return a successful No Content response", ->
				@res.sendStatus
					.calledWith(204)
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith(doc_id: @doc_id, project_id: @project_id, lines: @lines, source: @source, user_id: @user_id, undoing: @undoing, "setting doc via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@DocumentManager.setDocWithLock = sinon.stub().callsArgWith(6, new Error("oops"))
				@HttpController.setDoc(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true

		describe "when the payload is too large", ->
			beforeEach ->
				lines = []
				for _ in [0..200000]
					lines.push "test test test"
				@req.body.lines = lines
				@DocumentManager.setDocWithLock = sinon.stub().callsArgWith(6)
				@HttpController.setDoc(@req, @res, @next)

			it 'should send back a 406 response', ->
				@res.sendStatus.calledWith(406).should.equal true

			it 'should not call setDocWithLock', ->
				@DocumentManager.setDocWithLock.callCount.should.equal 0

	describe "flushProject", ->
		beforeEach ->
			@req =
				params:
					project_id: @project_id

		describe "successfully", ->
			beforeEach ->
				@ProjectManager.flushProjectWithLocks = sinon.stub().callsArgWith(1)
				@HttpController.flushProject(@req, @res, @next)

			it "should flush the project", ->
				@ProjectManager.flushProjectWithLocks
					.calledWith(@project_id)
					.should.equal true

			it "should return a successful No Content response", ->
				@res.sendStatus
					.calledWith(204)
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith(project_id: @project_id, "flushing project via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@ProjectManager.flushProjectWithLocks = sinon.stub().callsArgWith(1, new Error("oops"))
				@HttpController.flushProject(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true

	describe "flushDocIfLoaded", ->
		beforeEach ->
			@lines = ["one", "two", "three"]
			@version = 42
			@req =
				params:
					project_id: @project_id
					doc_id: @doc_id

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.flushDocIfLoadedWithLock = sinon.stub().callsArgWith(2)
				@HttpController.flushDocIfLoaded(@req, @res, @next)

			it "should flush the doc", ->
				@DocumentManager.flushDocIfLoadedWithLock
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should return a successful No Content response", ->
				@res.sendStatus
					.calledWith(204)
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith(doc_id: @doc_id, project_id: @project_id, "flushing doc via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@DocumentManager.flushDocIfLoadedWithLock = sinon.stub().callsArgWith(2, new Error("oops"))
				@HttpController.flushDocIfLoaded(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true

	describe "deleteDoc", ->
		beforeEach ->
			@req =
				params:
					project_id: @project_id
					doc_id: @doc_id
				query: {}

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.flushAndDeleteDocWithLock = sinon.stub().callsArgWith(3)
				@HttpController.deleteDoc(@req, @res, @next)

			it "should flush and delete the doc", ->
				@DocumentManager.flushAndDeleteDocWithLock
					.calledWith(@project_id, @doc_id, { ignoreFlushErrors: false })
					.should.equal true

			it "should flush project history", ->
				@HistoryManager.flushProjectChangesAsync
					.calledWithExactly(@project_id)
					.should.equal true

			it "should return a successful No Content response", ->
				@res.sendStatus
					.calledWith(204)
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith(doc_id: @doc_id, project_id: @project_id, "deleting doc via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "ignoring errors", ->
			beforeEach ->
				@req.query.ignore_flush_errors = 'true'
				@DocumentManager.flushAndDeleteDocWithLock = sinon.stub().yields()
				@HttpController.deleteDoc(@req, @res, @next)

			it "should delete the doc", ->
				@DocumentManager.flushAndDeleteDocWithLock
					.calledWith(@project_id, @doc_id, { ignoreFlushErrors: true })
					.should.equal true

			it "should return a successful No Content response", ->
				@res.sendStatus.calledWith(204).should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@DocumentManager.flushAndDeleteDocWithLock = sinon.stub().callsArgWith(3, new Error("oops"))
				@HttpController.deleteDoc(@req, @res, @next)

			it "should flush project history", ->
				@HistoryManager.flushProjectChangesAsync
					.calledWithExactly(@project_id)
					.should.equal true

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true

	describe "deleteProject", ->
		beforeEach ->
			@req =
				params:
					project_id: @project_id

		describe "successfully", ->
			beforeEach ->
				@ProjectManager.flushAndDeleteProjectWithLocks = sinon.stub().callsArgWith(2)
				@HttpController.deleteProject(@req, @res, @next)

			it "should delete the project", ->
				@ProjectManager.flushAndDeleteProjectWithLocks
					.calledWith(@project_id)
					.should.equal true

			it "should return a successful No Content response", ->
				@res.sendStatus
					.calledWith(204)
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith(project_id: @project_id, "deleting project via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "with the background=true option from realtime", ->
			beforeEach ->
				@ProjectManager.queueFlushAndDeleteProject = sinon.stub().callsArgWith(1)
				@req.query = {background:true, shutdown:true}
				@HttpController.deleteProject(@req, @res, @next)

			it "should queue the flush and delete", ->
				@ProjectManager.queueFlushAndDeleteProject
					.calledWith(@project_id)
					.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@ProjectManager.flushAndDeleteProjectWithLocks = sinon.stub().callsArgWith(2, new Error("oops"))
				@HttpController.deleteProject(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true

	describe "acceptChanges", ->
		beforeEach ->
			@req =
				params:
					project_id: @project_id
					doc_id: @doc_id
					change_id: @change_id = "mock-change-od-1"

		describe "successfully with a single change", ->
			beforeEach ->
				@DocumentManager.acceptChangesWithLock = sinon.stub().callsArgWith(3)
				@HttpController.acceptChanges(@req, @res, @next)

			it "should accept the change", ->
				@DocumentManager.acceptChangesWithLock
					.calledWith(@project_id, @doc_id, [ @change_id ])
					.should.equal true

			it "should return a successful No Content response", ->
				@res.sendStatus
					.calledWith(204)
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith({@project_id, @doc_id}, "accepting 1 changes via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "succesfully with with multiple changes", ->
			beforeEach ->
				@change_ids = [ "mock-change-od-1", "mock-change-od-2", "mock-change-od-3", "mock-change-od-4" ]
				@req.body =
					change_ids: @change_ids
				@DocumentManager.acceptChangesWithLock = sinon.stub().callsArgWith(3)
				@HttpController.acceptChanges(@req, @res, @next)

			it "should accept the changes in the body payload", ->
				@DocumentManager.acceptChangesWithLock
					.calledWith(@project_id, @doc_id, @change_ids)
					.should.equal true

			it "should log the request with the correct number of changes", ->
				@logger.log
					.calledWith({@project_id, @doc_id}, "accepting #{ @change_ids.length } changes via http")
					.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@DocumentManager.acceptChangesWithLock = sinon.stub().callsArgWith(3, new Error("oops"))
				@HttpController.acceptChanges(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true

	describe "deleteComment", ->
		beforeEach ->
			@req =
				params:
					project_id: @project_id
					doc_id: @doc_id
					comment_id: @comment_id = "mock-comment-id"

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.deleteCommentWithLock = sinon.stub().callsArgWith(3)
				@HttpController.deleteComment(@req, @res, @next)

			it "should accept the change", ->
				@DocumentManager.deleteCommentWithLock
					.calledWith(@project_id, @doc_id, @comment_id)
					.should.equal true

			it "should return a successful No Content response", ->
				@res.sendStatus
					.calledWith(204)
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith({@project_id, @doc_id, @comment_id}, "deleting comment via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@DocumentManager.deleteCommentWithLock = sinon.stub().callsArgWith(3, new Error("oops"))
				@HttpController.deleteComment(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true

	describe "getProjectDocsAndFlushIfOld", ->
		beforeEach ->
			@state = "01234567890abcdef"
			@docs = [{_id: "1234", lines: "hello", v: 23}, {_id: "4567", lines: "world", v: 45}]
			@req =
				params:
					project_id: @project_id
				query:
					state: @state

		describe "successfully", ->
			beforeEach ->
				@ProjectManager.getProjectDocsAndFlushIfOld = sinon.stub().callsArgWith(3,null, @docs)
				@HttpController.getProjectDocsAndFlushIfOld(@req, @res, @next)

			it "should get docs from the project manager", ->
				@ProjectManager.getProjectDocsAndFlushIfOld
					.calledWith(@project_id, @state, {})
					.should.equal true

			it "should return a successful response", ->
				@res.send
					.calledWith(@docs)
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith({project_id: @project_id, exclude: []}, "getting docs via http")
					.should.equal true

			it "should log the response", ->
				@logger.log
					.calledWith({project_id: @project_id, result: ["1234:23", "4567:45"]}, "got docs via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when there is a conflict", ->
			beforeEach ->
				@ProjectManager.getProjectDocsAndFlushIfOld = sinon.stub().callsArgWith(3, new Errors.ProjectStateChangedError("project state changed"))
				@HttpController.getProjectDocsAndFlushIfOld(@req, @res, @next)

			it "should return an HTTP 409 Conflict response", ->
				@res.sendStatus
					.calledWith(409)
					.should.equal true

		describe "when an error occurs", ->
			beforeEach ->
				@ProjectManager.getProjectDocsAndFlushIfOld = sinon.stub().callsArgWith(3, new Error("oops"))
				@HttpController.getProjectDocsAndFlushIfOld(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true

	describe "updateProject", ->
		beforeEach ->
			@projectHistoryId = "history-id-123"
			@userId = "user-id-123"
			@docUpdates = sinon.stub()
			@fileUpdates = sinon.stub()
			@version = 1234567
			@req =
				body: {@projectHistoryId, @userId, @docUpdates, @fileUpdates, @version}
				params:
					project_id: @project_id

		describe "successfully", ->
			beforeEach ->
				@ProjectManager.updateProjectWithLocks = sinon.stub().callsArgWith(6)
				@HttpController.updateProject(@req, @res, @next)

			it "should accept the change", ->
				@ProjectManager.updateProjectWithLocks
					.calledWith(@project_id, @projectHistoryId, @userId, @docUpdates, @fileUpdates, @version)
					.should.equal true

			it "should return a successful No Content response", ->
				@res.sendStatus
					.calledWith(204)
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@ProjectManager.updateProjectWithLocks = sinon.stub().callsArgWith(6, new Error("oops"))
				@HttpController.updateProject(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true

	describe "resyncProjectHistory", ->
		beforeEach ->
			@projectHistoryId = "history-id-123"
			@docs = sinon.stub()
			@files = sinon.stub()
			@fileUpdates = sinon.stub()
			@req =
				body:
					{@projectHistoryId, @docs, @files}
				params:
					project_id: @project_id

		describe "successfully", ->
			beforeEach ->
				@HistoryManager.resyncProjectHistory = sinon.stub().callsArgWith(4)
				@HttpController.resyncProjectHistory(@req, @res, @next)

			it "should accept the change", ->
				@HistoryManager.resyncProjectHistory
					.calledWith(@project_id, @projectHistoryId, @docs, @files)
					.should.equal true

			it "should return a successful No Content response", ->
				@res.sendStatus
					.calledWith(204)
					.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@HistoryManager.resyncProjectHistory = sinon.stub().callsArgWith(4, new Error("oops"))
				@HttpController.resyncProjectHistory(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true
