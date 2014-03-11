sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/DocumentManager.js"
SandboxedModule = require('sandboxed-module')

describe "DocumentManager - setDoc", ->
	beforeEach ->
		@DocumentManager = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./PersistenceManager": @PersistenceManager = {}
			"./DiffCodec": @DiffCodec = {}
			"./DocOpsManager":{}
			"./UpdateManager": @UpdateManager = {}
			"logger-sharelatex": @logger = {log: sinon.stub()}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()

		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@version = 42
		@ops = ["mock-ops"]
		@callback = sinon.stub()
		@source = "dropbox"
		@user_id = "mock-user-id"

	describe "with plain tex lines", ->
		beforeEach ->
			@beforeLines = ["before", "lines"]
			@afterLines = ["after", "lines"]

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @beforeLines, @version)
				@DiffCodec.diffAsShareJsOp = sinon.stub().callsArgWith(2, null, @ops)
				@UpdateManager.applyUpdates = sinon.stub().callsArgWith(3, null)
				@DocumentManager.flushDocIfLoaded = sinon.stub().callsArg(2)
				@DocumentManager.setDoc @project_id, @doc_id, @afterLines, @source, @user_id, @callback

			it "should get the current doc lines", ->
				@DocumentManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should return a diff of the old and new lines", ->
				@DiffCodec.diffAsShareJsOp
					.calledWith(@beforeLines, @afterLines)
					.should.equal true

			it "should apply the diff as a ShareJS op", ->
				@UpdateManager.applyUpdates
					.calledWith(
						@project_id,
						@doc_id,
						[
							doc: @doc_id,
							v: @version,
							op: @ops,
							meta: {
								type: "external"
								source: @source
								user_id: @user_id
							}
						]
					)
					.should.equal true

			it "should flush the doc to Mongo", ->
				@DocumentManager.flushDocIfLoaded
					.calledWith(@project_id, @doc_id)
					.should.equal true
			
			it "should call the callback", ->
				@callback.calledWith(null).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

	describe "without new lines", ->
		beforeEach ->
			@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @beforeLines, @version)
			@DocumentManager.setDoc @project_id, @doc_id, null, @callback

		it "should return teh callback with an error", ->
			@callback.calledWith(new Error("No lines were passed to setDoc"))
			
		it "should not try to get the doc lines", ->
			@DocumentManager.getDoc.called.should.equal false

		

		



