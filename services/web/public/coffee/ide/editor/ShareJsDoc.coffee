define [
	"utils/EventEmitter"
	"libs/sharejs"
], (EventEmitter, ShareJs) ->
	SINGLE_USER_FLUSH_DELAY = 1000 #ms

	class ShareJsDoc extends EventEmitter
		constructor: (@doc_id, docLines, version, @socket) ->
			# Dencode any binary bits of data
			# See http://ecmanaut.blogspot.co.uk/2006/07/encoding-decoding-utf8-in-javascript.html
			@type = "text"
			docLines = for line in docLines
				if line.text?
					@type = "json"
					line.text = decodeURIComponent(escape(line.text))
				else
					@type = "text"
					line = decodeURIComponent(escape(line))
				line

			if @type == "text"
				snapshot = docLines.join("\n")
			else if @type == "json"
				snapshot = { lines: docLines }
			else
				throw new Error("Unknown type: #{@type}")

			@connection = {
				send: (update) =>
					@_startInflightOpTimeout(update)
					if window.disconnectOnUpdate? and Math.random() < window.disconnectOnUpdate
						sl_console.log "Disconnecting on update", update
						window._ide.socket.socket.disconnect()
					if window.dropUpdates? and Math.random() < window.dropUpdates
						sl_console.log "Simulating a lost update", update
						return
					@socket.emit "applyOtUpdate", @doc_id, update, (error) =>
						return @_handleError(error) if error?
				state: "ok"
				id:    @socket.socket.sessionid
			}

			@_doc = new ShareJs.Doc @connection, @doc_id,
				type: @type
			@_doc.setFlushDelay(SINGLE_USER_FLUSH_DELAY)
			@_doc.on "change", () =>
				@trigger "change"
			@_doc.on "acknowledge", () =>
				@trigger "acknowledge"
			@_doc.on "remoteop", () =>
				# As soon as we're working with a collaborator, start sending
				# ops as quickly as possible for low latency.
				@_doc.setFlushDelay(0)
				@trigger "remoteop"
			@_doc.on "error", (e) =>
				@_handleError(e)

			@_bindToDocChanges(@_doc)

			@processUpdateFromServer
				open: true
				v: version
				snapshot: snapshot

		submitOp: (args...) -> @_doc.submitOp(args...)

		processUpdateFromServer: (message) ->
			try
				@_doc._onMessage message
			catch error
				# Version mismatches are thrown as errors
				@_handleError(error)

			if message?.meta?.type == "external"
				@trigger "externalUpdate", message

		catchUp: (updates) ->
			for update, i in updates
				update.v   = @_doc.version
				update.doc = @doc_id
				@processUpdateFromServer(update)

		getSnapshot: () -> @_doc.snapshot
		getVersion: () -> @_doc.version
		getType: () -> @type

		clearInflightAndPendingOps: () ->
			@_doc.inflightOp = null
			@_doc.inflightCallbacks = []
			@_doc.pendingOp = null
			@_doc.pendingCallbacks = []

		flushPendingOps: () ->
			# This will flush any ops that are pending.
			# If there is an inflight op it will do nothing.
			@_doc.flush()

		updateConnectionState: (state) ->
			sl_console.log "[updateConnectionState] Setting state to #{state}"
			@connection.state = state
			@connection.id = @socket.socket.sessionid
			@_doc.autoOpen = false
			@_doc._connectionStateChanged(state)

		hasBufferedOps: () ->
			@_doc.inflightOp? or @_doc.pendingOp?

		getInflightOp: () -> @_doc.inflightOp
		getPendingOp: () -> @_doc.pendingOp

		attachToAce: (ace) -> @_doc.attach_ace(ace, false, window.maxDocLength)
		detachFromAce: () -> @_doc.detach_ace?()
	
		INFLIGHT_OP_TIMEOUT: 5000 # Retry sending ops after 5 seconds without an ack
		_startInflightOpTimeout: (update) ->
			@_startFatalTimeoutTimer(update)
			timer = setTimeout () =>
				# Only send the update again if inflightOp is still populated
				# This can be cleared when hard reloading the document in which
				# case we don't want to keep trying to send it.
				if @_doc.inflightOp?
					# When there is a socket.io disconnect, @_doc.inflightSubmittedIds
					# is updated with the socket.io client id of the current op in flight
					# (meta.source of the op).
					# @connection.id is the client id of the current socket.io session.
					# So we need both depending on whether the op was submitted before
					# one or more disconnects, or if it was submitted during the current session.
					update.dupIfSource = [@connection.id, @_doc.inflightSubmittedIds...]
					@connection.send(update)
			, @INFLIGHT_OP_TIMEOUT
			@_doc.inflightCallbacks.push () =>
				@_clearFatalTimeoutTimer()
				clearTimeout timer

		FATAL_OP_TIMEOUT: 30000 # 30 seconds
		_startFatalTimeoutTimer: (update) ->
			# If an op doesn't get acked within FATAL_OP_TIMEOUT, something has
			# gone unrecoverably wrong (the op will have been retried multiple times)
			return if @_timeoutTimer?
			@_timeoutTimer = setTimeout () =>
				@_clearFatalTimeoutTimer()
				@trigger "op:timeout", update
			, @FATAL_OP_TIMEOUT
		
		_clearFatalTimeoutTimer: () ->
			return if !@_timeoutTimer?
			clearTimeout @_timeoutTimer
			@_timeoutTimer = null

		_handleError: (error, meta = {}) ->
			@trigger "error", error, meta

		_bindToDocChanges: (doc) ->
			submitOp = doc.submitOp
			doc.submitOp = (args...) =>
				@trigger "op:sent", args...
				doc.pendingCallbacks.push () =>
					@trigger "op:acknowledged", args...
				submitOp.apply(doc, args)

			flush = doc.flush
			doc.flush = (args...) =>
				@trigger "flush", doc.inflightOp, doc.pendingOp, doc.version
				flush.apply(doc, args)
