define [
	"libs/chai"
	"editor/Document"
	"editor/ShareJsDoc"
	"libs/sinon"
], (
	chai
	Document
	ShareJsDoc
) ->
	should = chai.should()

	describe "Document", ->
		beforeEach ->
			@ide =
				socket: @socket =
					socket:
						sessionid: @session_id = "mock-session-id"
						connected: true
					emit: (name, args..., callback = () ->) ->
						if @handlers[name]?
							@handlers[name].call(@, args..., callback)
					handlers: {}
			sinon.spy @ide.socket, "emit"
			_.extend(@ide, Backbone.Events)
			_.extend(@socket, Backbone.Events)
			@socket.removeListener = @socket.off

			sinon.spy ShareJsDoc::, "flushPendingOps"
			sinon.spy ShareJsDoc::, "updateConnectionState"

			@doc_id = "mock-doc-id"
			@docLines = ["hello", "world"]
			@version = 5
			@remote_session_id = "remote-session-id"

			@socket.handlers["joinDoc"] = (doc_id, args...) =>
				doc_id.should.equal @doc_id
				callback = args.pop()
				callback null, @docLines, @version, []
			@socket.handlers["leaveDoc"] = (doc_id, args...) =>
				doc_id.should.equal @doc_id
				callback = args.pop()
				callback null


			@doc = new Document(@ide, @doc_id)
			sinon.spy @doc, "trigger"

		afterEach ->
			ShareJsDoc::flushPendingOps.restore()
			ShareJsDoc::updateConnectionState.restore()

		# This is a little pattern I'm trying out to make the tests below much
		# more readable when they have a lot of repetition
		CONDITIONS =
			"connected": () ->
				@doc.connected = true

			"not connected": () ->
				@doc.connected = false

			"reconnected": () ->
				@ide.trigger "afterJoinProject"

			"disconnected": () ->
				@ide.socket.trigger "disconnect"

			"joining": () ->
				@callback = sinon.stub()
				@doc.join @callback

			"joined": () ->
				@callback = sinon.stub()
				@doc.join @callback

			"leaving": () ->
				@callback = sinon.stub()
				@doc.leave @callback

			"there are buffered ops": () ->
				sinon.stub @doc.doc, "hasBufferedOps", () -> return true

			"the buffered ops have been sent and acknowledged": () ->
				sinon.stub @doc.doc, "processUpdateFromServer"
				@doc.doc.hasBufferedOps.restore()
				@ide.socket.trigger "otUpdateApplied", { doc: @doc_id }
				@doc.doc.processUpdateFromServer.restore()

		TESTS =
			"emit joinDoc": () ->
				@socket.emit.calledWith("joinDoc", @doc_id).should.equal true

			"not emit joinDoc": () ->
				@socket.emit.calledWith("joinDoc").should.equal false

			"emit leaveDoc": () ->
				@socket.emit.calledWith("leaveDoc", @doc_id).should.equal true

			"not emit leaveDoc": () ->
				@socket.emit.calledWith("leaveDoc").should.equal false

			"be joined": () ->
				@doc.joined.should.equal true

			"not be joined": () ->
				@doc.joined.should.equal false

			"be wanting to be joined": () ->
				@doc.wantToBeJoined.should.equal true

			"not be wanting to be joined": () ->
				@doc.wantToBeJoined.should.equal false

			"call the callback": () ->
				@callback.called.should.equal true

			"not call the callback": () ->
				@callback.called.should.equal false

			"flush any pending ops": () ->
				ShareJsDoc::flushPendingOps.called.should.equal true

			"update the connection state to ok": () ->
				ShareJsDoc::updateConnectionState.calledWith("ok").should.equal true

		WHEN   = (condition, callback) -> [
				"when " + condition,
				() ->
					beforeEach CONDITIONS[condition]
					callback()
			]

		SHOULD = (test) -> ["should " + test, TESTS[test]]
				

		describe WHEN("connected", ->
			describe WHEN("joining", ->
				it SHOULD("emit joinDoc")...
				it SHOULD("be joined")...
				it SHOULD("be wanting to be joined")...
				it SHOULD("call the callback")...
			)...

			describe WHEN("leaving", ->
				it SHOULD("emit leaveDoc")...
				it SHOULD("not be joined")...
				it SHOULD("not be wanting to be joined")...
				it SHOULD("call the callback")...
			)...

			describe WHEN("joined", ->
				describe WHEN("there are buffered ops", ->
					describe WHEN("leaving", ->
						it SHOULD("not emit leaveDoc")...
						it SHOULD("be joined")...
						it SHOULD("not be wanting to be joined")...
						it SHOULD("not call the callback")...

						describe WHEN("the buffered ops have been sent and acknowledged", ->
							it SHOULD("emit leaveDoc")...
							it SHOULD("not be joined")...
							it SHOULD("not be wanting to be joined")...
							it SHOULD("call the callback")...
						)...
					)...
				)...

				describe WHEN("disconnected", ->
					describe WHEN("leaving", ->
						it SHOULD("not be wanting to be joined")...
						it SHOULD("not emit leaveDoc")...
						it SHOULD("call the callback")...

						describe WHEN("reconnected", ->
							it SHOULD("not emit leaveDoc")...
							it SHOULD("not be joined")...
							it SHOULD("not be wanting to be joined")...
						)...
					)...

					describe WHEN("there are buffered ops", ->
						describe WHEN("leaving", ->
							it SHOULD("not be wanting to be joined")...
							it SHOULD("not emit leaveDoc")...
							it SHOULD("not call the callback")...

							describe WHEN("reconnected", ->
								it SHOULD("emit joinDoc")...
								it SHOULD("flush any pending ops")...
								describe WHEN("the buffered ops have been sent and acknowledged", ->
									it SHOULD("emit leaveDoc")...
									it SHOULD("not be joined")...
									it SHOULD("not be wanting to be joined")...
									it SHOULD("call the callback")...
								)...
							)...
						)...
					)...
				)...
			)...
		)...

		describe WHEN("not connected", ->
			describe WHEN("joining", ->
				it SHOULD("be wanting to be joined")...
				it SHOULD("not emit joinDoc")...
				it SHOULD("not be joined")...
				it SHOULD("not call the callback")...
				describe WHEN("reconnected", ->
					it SHOULD("emit joinDoc")...
					it SHOULD("be joined")...
					it SHOULD("be wanting to be joined")...
					it SHOULD("flush any pending ops")...
					it SHOULD("update the connection state to ok")...
				)...
			)...
		)...

		describe "leaving a doc", ->
			describe "when not connected", ->
				describe "with buffered ops", ->
					it "should not be wanting to be joined"

					describe "when reconnected", ->
						it "should emit joinDoc"
						it "should flush the bufferedOps"
						it "should emit leaveDoc"
						it "should not be joined"
						it "should be wanting to be joined"
						it "should call the callback"


