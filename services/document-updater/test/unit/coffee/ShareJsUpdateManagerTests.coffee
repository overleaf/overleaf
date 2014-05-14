sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../app/js/ShareJsUpdateManager.js"
SandboxedModule = require('sandboxed-module')

describe "ShareJsUpdateManager", ->
	beforeEach ->
		@project_id = "project-id-123"
		@doc_id = "document-id-123"
		@callback = sinon.stub()
		@ShareJsUpdateManager = SandboxedModule.require modulePath,
			requires:
				"./sharejs/server/model":
					class Model
						constructor: (@db) ->
				"./ShareJsDB" : @ShareJsDB = { mockDB: true }
				"redis" : createClient: () => @rclient = auth:->
				"logger-sharelatex": @logger = { log: sinon.stub() }
			globals:
				clearTimeout: @clearTimeout = sinon.stub()

	describe "applyUpdates", ->
		beforeEach ->
			@version = 34
			@model =
				applyOp: sinon.stub().callsArg(2)
				getSnapshot: sinon.stub()
			@ShareJsUpdateManager.getNewShareJsModel = sinon.stub().returns(@model)
			@ShareJsUpdateManager._listenForOps = sinon.stub()
			@ShareJsUpdateManager.removeDocFromCache = sinon.stub().callsArg(1)
			@updates = [
				{p: 4, t: "foo"}
				{p: 6, t: "bar"}
			]
			@updatedDocLines = ["one", "two"]

		describe "successfully", ->
			beforeEach (done) ->
				@model.getSnapshot.callsArgWith(1, null, {snapshot: @updatedDocLines.join("\n"), v: @version})
				@ShareJsUpdateManager.applyUpdates @project_id, @doc_id, @updates, (err, docLines, version) =>
					@callback(err, docLines, version)
					done()

			it "should create a new ShareJs model", ->
				@ShareJsUpdateManager.getNewShareJsModel
					.called.should.equal true

			it "should listen for ops on the model", ->
				@ShareJsUpdateManager._listenForOps
					.calledWith(@model)
					.should.equal true

			it "should send each update to ShareJs", ->
				for update in @updates
					@model.applyOp
						.calledWith("#{@project_id}:#{@doc_id}", update).should.equal true

			it "should get the updated doc lines", ->
				@model.getSnapshot
					.calledWith("#{@project_id}:#{@doc_id}")
					.should.equal true

			it "should return the updated doc lines", ->
				@callback.calledWith(null, @updatedDocLines, @version).should.equal true

		describe "when applyOp fails", ->
			beforeEach (done) ->
				@error = new Error("Something went wrong")
				@ShareJsUpdateManager._sendError = sinon.stub()
				@model.applyOp = sinon.stub().callsArgWith(2, @error)
				@ShareJsUpdateManager.applyUpdates @project_id, @doc_id, @updates, (err, docLines, version) =>
					@callback(err, docLines, version)
					done()

			it "should call sendError with the error", ->
				@ShareJsUpdateManager._sendError
					.calledWith(@project_id, @doc_id, @error)
					.should.equal true

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true

		describe "when getSnapshot fails", ->
			beforeEach (done) ->
				@error = new Error("Something went wrong")
				@ShareJsUpdateManager._sendError = sinon.stub()
				@model.getSnapshot.callsArgWith(1, @error)
				@ShareJsUpdateManager.applyUpdates @project_id, @doc_id, @updates, (err, docLines, version) =>
					@callback(err, docLines, version)
					done()

			it "should call sendError with the error", ->
				@ShareJsUpdateManager._sendError
					.calledWith(@project_id, @doc_id, @error)
					.should.equal true

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true

	describe "_listenForOps", ->
		beforeEach ->
			@model = on: (event, callback) =>
				@callback = callback
			sinon.spy @model, "on"
			@ShareJsUpdateManager._listenForOps(@model)

		it "should listen to the model for updates", ->
			@model.on.calledWith("applyOp")
				.should.equal true

		describe "the callback", ->
			beforeEach ->
				@opData =
					op: {t: "foo", p: 1}
					meta: source: "bar"
				@rclient.publish = sinon.stub()
				@callback("#{@project_id}:#{@doc_id}", @opData)

			it "should publish the op to redis", ->
				@rclient.publish
					.calledWith("applied-ops", JSON.stringify(project_id: @project_id, doc_id: @doc_id, op: @opData))
					.should.equal true

	describe "_sendError", ->
		beforeEach ->
			@error_text = "Something went wrong"
			@rclient.publish = sinon.stub()
			@ShareJsUpdateManager._sendError(@project_id, @doc_id, new Error(@error_text))

		it "should publish the error to the redis stream", ->
			@rclient.publish
				.calledWith("applied-ops", JSON.stringify(project_id: @project_id, doc_id: @doc_id, error: @error_text))
				.should.equal true

