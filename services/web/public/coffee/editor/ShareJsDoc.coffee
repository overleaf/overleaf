define [
	"libs/sharejs"
	"libs/backbone"
], (ShareJs) ->
	class ShareJsDoc
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
					@socket.emit "applyOtUpdate", @doc_id, update
				state: "ok"
				id:    @socket.socket.sessionid
			}

			@_doc = new ShareJs.Doc @connection, @doc_id,
				type: @type
			@_doc.on "change", () =>
				@trigger "change"
			@_doc.on "acknowledge", () =>
				@trigger "acknowledge"
			@_doc.on "remoteop", () =>
				@trigger "remoteop"

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
				@trigger "externalUpdate"

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
			@connection.state = state
			@connection.id = @socket.socket.sessionid
			@_doc.autoOpen = false
			@_doc._connectionStateChanged(state)

		hasBufferedOps: () ->
			@_doc.inflightOp? or @_doc.pendingOp?

		attachToAce: (ace) -> @_doc.attach_ace(ace)
		detachFromAce: () -> @_doc.detach_ace?()
	
		INFLIGHT_OP_TIMEOUT: 10000
		_startInflightOpTimeout: (update) ->
			meta =
				v: update.v
				op_sent_at: new Date()
			timer = setTimeout () =>
				@trigger "op:timeout", update
			, @INFLIGHT_OP_TIMEOUT
			@_doc.inflightCallbacks.push () =>
				clearTimeout timer

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

	_.extend(ShareJsDoc::, Backbone.Events)

	return ShareJsDoc
