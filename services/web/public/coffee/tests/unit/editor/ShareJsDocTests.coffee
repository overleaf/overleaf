define [
	"libs/chai"
	"editor/ShareJsDoc"
	"libs/sharejs"
	"libs/sinon"
], (
	chai
	ShareJsDoc
	ShareJs
) ->
	should = chai.should()
	expect = chai.expect

	describe "ShareJsDoc", ->
		beforeEach ->
			@lines = ["hello", "world"]
			@snapshot = @lines.join("\n")
			@doc_id = "mock-doc-id"
			@version = 42

			socket: @socket =
				socket:
					sessionid: @session_id = "mock-session-id"
					connected: true
				emit: sinon.stub()
			
			sinon.spy ShareJs.Doc::, "_onMessage"
			sinon.spy ShareJs.Doc::, "on"
			sinon.spy ShareJs, "Doc"

		afterEach ->
			ShareJs.Doc::_onMessage.restore()
			ShareJs.Doc::on.restore()
			ShareJs.Doc.restore()

		describe "Creating a ShareJsDoc", ->
			beforeEach ->
				@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)

			it "should create a new ShareJs.Doc instance", ->
				expect(@shareJsDoc._doc instanceof ShareJs.Doc).to.be.true

			it "should set the ShareJs doc connection", ->
				ShareJs.Doc
					.calledWith(@shareJsDoc.connection)
					.should.equal true

			it "should set the ShareJs doc name", ->
				ShareJs.Doc
					.calledWith(sinon.match.any, @doc_id)
					.should.equal true

			it "should set the type of the ShareJs doc to 'text'", ->
				ShareJs.Doc
					.calledWith(sinon.match.any, sinon.match.any, type: "text")
					.should.equal true

			it "should open the ShareJs doc so that it is in an active state", ->
				ShareJs.Doc::_onMessage
					.calledWith({
						open:     true
						snapshot: @snapshot
						v:        @version
					})
					.should.equal true

			it "should bind to the ShareJs doc events", ->
				ShareJs.Doc::on.calledWith("change").should.equal true
				ShareJs.Doc::on.calledWith("acknowledge").should.equal true
				ShareJs.Doc::on.calledWith("remoteop").should.equal true

		describe "Sending an op", ->
			describe "when the server responds", ->
				beforeEach (done) ->
					@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)
					@shareJsDoc.submitOp @op = [p: 5, i: "foo"], () -> done()

					# Send the acknowledgement so that the callback is called
					setTimeout () =>
						@shareJsDoc.processUpdateFromServer {
							v:   @version
							doc: @doc_id
						}
					, 10


				it "should send the op to the server", ->
					@socket.emit
						.calledWith("applyOtUpdate", @doc_id, {
							doc: @doc_id,
							op:  @op
							v:   @version
						})
						.should.equal true

				it "should update the document snapshot", ->
					@shareJsDoc.getSnapshot().should.equal "hellofoo\nworld"

			describe "when the server does not respond", ->
				beforeEach (done) ->
					@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)
					sinon.spy @shareJsDoc, "trigger"
					@shareJsDoc.INFLIGHT_OP_TIMEOUT = 50
					@shareJsDoc.submitOp @op = [p: 5, i: "foo"]

					setTimeout () ->
						done()
					, 100

				it "should trigger an error", ->
					@shareJsDoc.trigger
						.calledWith("error", "Doc op was not acknowledged in time")
						.should.equal true

		describe "clearInflightAndPendingOps", ->
			beforeEach ->
				@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)
				@shareJsDoc._doc.inflightOp = "mock-op-1"
				@shareJsDoc._doc.inflightCallbacks = ["mock-callback-1"]
				@shareJsDoc._doc.pendingOp = "mock-op-2"
				@shareJsDoc._doc.pendingCallbacks = ["mock-callback-2"]
				
				@shareJsDoc.clearInflightAndPendingOps()

			it "should clear any inflight or pendings ops", ->
				expect(@shareJsDoc._doc.inflightOp).to.be.null
				@shareJsDoc._doc.inflightCallbacks.should.deep.equal []
				expect(@shareJsDoc._doc.pendingOp).to.be.null
				@shareJsDoc._doc.pendingCallbacks.should.deep.equal []

		describe "flushPendingOps", ->
			beforeEach ->
				@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)
				@shareJsDoc._doc.flush = sinon.stub()
				@shareJsDoc.flushPendingOps()

			it "should call _doc.flush", ->
				@shareJsDoc._doc.flush.called.should.equal true

		describe "updateConnectionState", ->
			beforeEach ->
				@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)
				@shareJsDoc._doc._connectionStateChanged = sinon.stub()
				@shareJsDoc._doc.autoOpen = true
				@socket.socket.sessionid = "new-connection-id"

				@shareJsDoc.updateConnectionState "mock-state"

			it "should set autoOpen to false so that ShareJs doesn't try to send an open message", ->
				@shareJsDoc._doc.autoOpen.should.equal false

			it "should update the connection state", ->
				@shareJsDoc.connection.state.should.equal "mock-state"

			it "should notify the ShareJs doc of the state change", ->
				@shareJsDoc._doc._connectionStateChanged
					.calledWith("mock-state")
					.should.equal true

			it "should set the connection id to the latest socket id", ->
				@shareJsDoc.connection.id.should.equal "new-connection-id"

		describe "hasBufferedOps", ->
			describe "with inflight ops", ->
				beforeEach ->
					@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)
					@shareJsDoc._doc.inflightOp = "mock-op-1"

				it "should return true", ->
					@shareJsDoc.hasBufferedOps().should.equal true
					
			describe "with pending ops", ->
				beforeEach ->
					@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)
					@shareJsDoc._doc.pendingOp = "mock-op-1"

				it "should return true", ->
					@shareJsDoc.hasBufferedOps().should.equal true
				
			describe "with no buffered ops", ->
				beforeEach ->
					@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)

				it "should return false", ->
					@shareJsDoc.hasBufferedOps().should.equal false
				
		describe "processUpdateFromServer", ->
			describe "successfully", ->
				beforeEach ->
					@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)
					@shareJsDoc._doc._onMessage = sinon.stub()
					@shareJsDoc.processUpdateFromServer "mock-message"

				it "should pass the message onto the ShareJs Doc", ->
					@shareJsDoc._doc._onMessage
						.calledWith( "mock-message" )
						.should.equal true

			describe "with an error", ->
				beforeEach ->
					@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)
					sinon.spy @shareJsDoc, "trigger"
					@shareJsDoc._doc._onMessage = sinon.stub().throws(@error = {message: "Mock error"})
					@shareJsDoc.processUpdateFromServer "mock-message"

				it "should trigger the error handler", ->
					@shareJsDoc.trigger
						.calledWith("error", @error)
						.should.equal true

			describe "with an external update", ->
				beforeEach ->
					@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)
					@shareJsDoc._doc._onMessage = sinon.stub()
					sinon.spy @shareJsDoc, "trigger"
					@shareJsDoc.processUpdateFromServer { op: "mock-op", meta: { type: "external" } }

				it "should trigger an externalUpdate event", ->
					@shareJsDoc.trigger
						.calledWith("externalUpdate")
						.should.equal true
				

		describe "catchUp", ->
			beforeEach ->
				@shareJsDoc = new ShareJsDoc(@doc_id, @lines, @version, @socket)
				sinon.stub @shareJsDoc, "processUpdateFromServer", () ->
					@_doc.version++

				@shareJsDoc.catchUp [{
					ops: ["mock-op-1"]
				}, {
					ops: ["mock-op-2"]
				}]
					
			it "should apply each update", ->
				@shareJsDoc.processUpdateFromServer
					.calledWith({
						doc: @doc_id
						v:   @version
						ops: ["mock-op-1"]
					})
					.should.equal true

				@shareJsDoc.processUpdateFromServer
					.calledWith({
						doc: @doc_id
						v:   @version + 1
						ops: ["mock-op-2"]
					})
					.should.equal true
