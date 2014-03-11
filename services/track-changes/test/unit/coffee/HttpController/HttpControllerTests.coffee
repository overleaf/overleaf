sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/HttpController.js"
SandboxedModule = require('sandboxed-module')

describe "HttpController", ->
	beforeEach ->
		@HttpController = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": { log: sinon.stub() }
			"./UpdatesManager": @UpdatesManager = {}
			"./DiffManager": @DiffManager = {}
			"./RestoreManager": @RestoreManager = {}
		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
		@next = sinon.stub()
		@user_id = "mock-user-123"
		@now = Date.now()

	describe "flushUpdatesWithLock", ->
		beforeEach ->
			@req =
				params:
					doc_id: @doc_id
			@res =
				send: sinon.stub()
			@UpdatesManager.processUncompressedUpdatesWithLock = sinon.stub().callsArg(1)
			@HttpController.flushUpdatesWithLock @req, @res, @next

		it "should process the updates", ->
			@UpdatesManager.processUncompressedUpdatesWithLock
				.calledWith(@doc_id)
				.should.equal true

		it "should return a success code", ->
			@res.send.calledWith(204).should.equal true

	describe "getDiff", ->
		beforeEach ->
			@from = 42
			@to = 45
			@req =
				params:
					doc_id: @doc_id
					project_id: @project_id
				query:
					from: @from.toString()
					to: @to.toString()
			@res =
				send: sinon.stub()
			@diff = [ u: "mock-diff" ]
			@DiffManager.getDiff = sinon.stub().callsArgWith(4, null, @diff)
			@HttpController.getDiff @req, @res, @next

		it "should get the diff", ->
			@DiffManager.getDiff
				.calledWith(@project_id, @doc_id, parseInt(@from, 10), parseInt(@to, 10))
				.should.equal true

		it "should return the diff", ->
			@res.send.calledWith(JSON.stringify(diff: @diff)).should.equal true

	describe "getUpdates", ->
		beforeEach ->
			@to = 42
			@limit = 10
			@req =
				params:
					doc_id: @doc_id
					project_id: @project_id
				query:
					to:    @to.toString()
					limit: @limit.toString()
			@res =
				send: sinon.stub()
			@rawUpdates = ["raw-updates"]
			@updatesView = ["updates-view"]
			@HttpController._buildUpdatesView = sinon.stub().returns(@updatesView)
			@UpdatesManager.getUpdatesWithUserInfo = sinon.stub().callsArgWith(2, null, @rawUpdates)
			@HttpController.getUpdates @req, @res, @next

		it "should get the updates", ->
			@UpdatesManager.getUpdatesWithUserInfo
				.calledWith(@doc_id, to: @to, limit: @limit)
				.should.equal true

		it "should build the updates view", ->
			@HttpController._buildUpdatesView
				.calledWith(@rawUpdates)
				.should.equal true

		it "should return the formatted updates", ->
			@res.send.calledWith(JSON.stringify(updates: @updatesView)).should.equal true

	describe "_buildUpdatesView", ->
		it "should concat updates that are close in time", ->
			expect(@HttpController._buildUpdatesView [{
				meta:
					user: @user_2 = { id: "mock-user-2" }
					start_ts: @now + 20
					end_ts:   @now + 30
				v: 5
			}, {
				meta:
					user: @user_1 = { id: "mock-user-1" }
					start_ts: @now
					end_ts:   @now + 10
				v: 4
			}]).to.deep.equal [{
				meta:
					users: [@user_1, @user_2]
					start_ts: @now
					end_ts:   @now + 30
				fromV: 4
				toV:   5
			}]

		it "should leave updates that are far apart in time", ->
			oneDay = 1000 * 60 * 60 * 24
			expect(@HttpController._buildUpdatesView [{
				meta:
					user: @user_2 = { id: "mock-user-2" }
					start_ts: @now + oneDay
					end_ts:   @now + oneDay + 10
				v: 5
			}, {
				meta:
					user: @user_1 = { id: "mock-user-2" }
					start_ts: @now
					end_ts:   @now + 10
				v: 4
			}]).to.deep.equal [{
				meta:
					users: [@user_2]
					start_ts: @now + oneDay
					end_ts:   @now + oneDay + 10
				fromV: 5
				toV: 5
			}, {
				meta:
					users: [@user_1]
					start_ts: @now
					end_ts:   @now + 10
				fromV: 4
				toV: 4
			}]

	describe "RestoreManager", ->
		beforeEach ->
			@version = "42"
			@req =
				params:
					doc_id: @doc_id
					project_id: @project_id
					version: @version
				headers:
					"x-user-id": @user_id
			@res =
				send: sinon.stub()

			@RestoreManager.restoreToBeforeVersion = sinon.stub().callsArg(4)
			@HttpController.restore @req, @res, @next

		it "should restore the document", ->
			@RestoreManager.restoreToBeforeVersion
				.calledWith(@project_id, @doc_id, parseInt(@version, 10), @user_id)
				.should.equal true

		it "should return a success code", ->
			@res.send.calledWith(204).should.equal true
