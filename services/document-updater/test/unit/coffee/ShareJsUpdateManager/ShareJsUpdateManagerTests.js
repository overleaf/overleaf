sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/ShareJsUpdateManager.js"
SandboxedModule = require('sandboxed-module')
crypto = require('crypto')

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
				"redis-sharelatex" : createClient: () => @rclient = auth:->
				"logger-sharelatex": @logger = { log: sinon.stub() }
				"./RealTimeRedisManager": @RealTimeRedisManager = {}
				"./Metrics": @metrics = { inc: sinon.stub() }
			globals:
				clearTimeout: @clearTimeout = sinon.stub()

	describe "applyUpdate", ->
		beforeEach ->
			@lines = ["one", "two"]
			@version = 34
			@updatedDocLines = ["onefoo", "two"]
			content = @updatedDocLines.join("\n")
			@hash = crypto.createHash('sha1').update("blob " + content.length + "\x00").update(content, 'utf8').digest('hex')
			@update = {p: 4, t: "foo", v:@version, hash:@hash}
			@model =
				applyOp: sinon.stub().callsArg(2)
				getSnapshot: sinon.stub()
				db:
					appliedOps: {}
			@ShareJsUpdateManager.getNewShareJsModel = sinon.stub().returns(@model)
			@ShareJsUpdateManager._listenForOps = sinon.stub()
			@ShareJsUpdateManager.removeDocFromCache = sinon.stub().callsArg(1)

		describe "successfully", ->
			beforeEach (done) ->
				@model.getSnapshot.callsArgWith(1, null, {snapshot: @updatedDocLines.join("\n"), v: @version})
				@model.db.appliedOps["#{@project_id}:#{@doc_id}"] = @appliedOps = ["mock-ops"]
				@ShareJsUpdateManager.applyUpdate @project_id, @doc_id, @update, @lines, @version, (err, docLines, version, appliedOps) =>
					@callback(err, docLines, version, appliedOps)
					done()

			it "should create a new ShareJs model", ->
				@ShareJsUpdateManager.getNewShareJsModel
					.calledWith(@project_id, @doc_id, @lines, @version)
					.should.equal true

			it "should listen for ops on the model", ->
				@ShareJsUpdateManager._listenForOps
					.calledWith(@model)
					.should.equal true

			it "should send the update to ShareJs", ->
				@model.applyOp
					.calledWith("#{@project_id}:#{@doc_id}", @update)
					.should.equal true

			it "should get the updated doc lines", ->
				@model.getSnapshot
					.calledWith("#{@project_id}:#{@doc_id}")
					.should.equal true

			it "should return the updated doc lines, version and ops", ->
				@callback.calledWith(null, @updatedDocLines, @version, @appliedOps).should.equal true

		describe "when applyOp fails", ->
			beforeEach (done) ->
				@error = new Error("Something went wrong")
				@model.applyOp = sinon.stub().callsArgWith(2, @error)
				@ShareJsUpdateManager.applyUpdate @project_id, @doc_id, @update, @lines, @version, (err, docLines, version) =>
					@callback(err, docLines, version)
					done()

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true

		describe "when getSnapshot fails", ->
			beforeEach (done) ->
				@error = new Error("Something went wrong")
				@model.getSnapshot.callsArgWith(1, @error)
				@ShareJsUpdateManager.applyUpdate @project_id, @doc_id, @update, @lines, @version, (err, docLines, version) =>
					@callback(err, docLines, version)
					done()

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true

		describe "with an invalid hash", ->
			beforeEach (done) ->
				@error = new Error("invalid hash")
				@model.getSnapshot.callsArgWith(1, null, {snapshot: "unexpected content", v: @version})
				@model.db.appliedOps["#{@project_id}:#{@doc_id}"] = @appliedOps = ["mock-ops"]
				@ShareJsUpdateManager.applyUpdate @project_id, @doc_id, @update, @lines, @version, (err, docLines, version, appliedOps) =>
					@callback(err, docLines, version, appliedOps)
					done()

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
				@RealTimeRedisManager.sendData = sinon.stub()
				@callback("#{@project_id}:#{@doc_id}", @opData)

			it "should publish the op to redis", ->
				@RealTimeRedisManager.sendData
					.calledWith({project_id: @project_id, doc_id: @doc_id, op: @opData})
					.should.equal true

