define [
	"utils/EventEmitter"
	"ide/editor/ShareJsDoc"
], (EventEmitter, ShareJsDoc) ->
	class Document extends EventEmitter
		@getDocument: (ide, doc_id) ->
			@openDocs ||= {}
			if !@openDocs[doc_id]?
				sl_console.log "[getDocument] Creating new document instance for #{doc_id}"
				@openDocs[doc_id] = new Document(ide, doc_id)
			else
				sl_console.log "[getDocument] Returning existing document instance for #{doc_id}"
			return @openDocs[doc_id]

		@hasUnsavedChanges: () ->
			for doc_id, doc of (@openDocs or {})
				return true if doc.hasBufferedOps()
			return false

		@flushAll: () ->
			for doc_id, doc of @openDocs
				doc.flush()

		constructor: (@ide, @doc_id) ->
			@connected = @ide.socket.socket.connected
			@joined = false
			@wantToBeJoined = false
			@_checkConsistency = _.bind(@_checkConsistency, @)
			@inconsistentCount = 0
			@_bindToEditorEvents()
			@_bindToSocketEvents()

		attachToAce: (@ace) ->
			@doc?.attachToAce(@ace)
			editorDoc = @ace.getSession().getDocument()
			editorDoc.on "change", @_checkConsistency

		detachFromAce: () ->
			@doc?.detachFromAce()
			editorDoc = @ace?.getSession().getDocument()
			editorDoc?.off "change", @_checkConsistency
			@ide.$scope.$emit 'document:closed', @doc

		_checkConsistency: () ->
			# We've been seeing a lot of errors when I think there shouldn't be
			# any, which may be related to this check happening before the change is
			# applied. If we use a timeout, hopefully we can reduce this.
			setTimeout () =>
				editorValue = @ace?.getValue()
				sharejsValue = @doc?.getSnapshot()
				if editorValue != sharejsValue
					@inconsistentCount++
				else
					@inconsistentCount = 0

				if @inconsistentCount >= 3
					@_onError new Error("Editor text does not match server text")
			, 0

		getSnapshot: () ->
			@doc?.getSnapshot()

		getType: () ->
			@doc?.getType()

		getInflightOp: () ->
			@doc?.getInflightOp()

		getPendingOp: () ->
			@doc?.getPendingOp()

		getRecentAck: () ->
			@doc?.getRecentAck()

		getOpSize: (op) ->
			@doc?.getOpSize(op)

		hasBufferedOps: () ->
			@doc?.hasBufferedOps()

		_bindToSocketEvents: () ->
			@_onUpdateAppliedHandler = (update) => @_onUpdateApplied(update)
			@ide.socket.on "otUpdateApplied", @_onUpdateAppliedHandler
			@_onErrorHandler = (error, update) => @_onError(error, update)
			@ide.socket.on "otUpdateError", @_onErrorHandler
			@_onDisconnectHandler = (error) => @_onDisconnect(error)
			@ide.socket.on "disconnect", @_onDisconnectHandler

		_bindToEditorEvents: () ->
			onReconnectHandler = (update) =>
				@_onReconnect(update)
			@_unsubscribeReconnectHandler = @ide.$scope.$on "project:joined", onReconnectHandler

		_unBindFromEditorEvents: () ->
			@_unsubscribeReconnectHandler()

		_unBindFromSocketEvents: () ->
			@ide.socket.removeListener "otUpdateApplied", @_onUpdateAppliedHandler
			@ide.socket.removeListener "otUpdateError", @_onErrorHandler
			@ide.socket.removeListener "disconnect", @_onDisconnectHandler

		leaveAndCleanUp: () ->
			@leave (error) =>
				@_cleanUp()

		join: (callback = (error) ->) ->
			@wantToBeJoined = true
			@_cancelLeave()
			if @connected
				return @_joinDoc callback
			else
				@_joinCallbacks ||= []
				@_joinCallbacks.push callback

		leave: (callback = (error) ->) ->
			@wantToBeJoined = false
			@_cancelJoin()
			if (@doc? and @doc.hasBufferedOps())
				sl_console.log "[leave] Doc has buffered ops, pushing callback for later"
				@_leaveCallbacks ||= []
				@_leaveCallbacks.push callback
			else if !@connected
				sl_console.log "[leave] Not connected, returning now"
				callback()
			else
				sl_console.log "[leave] Leaving now"
				@_leaveDoc(callback)

		flush: () ->
			@doc?.flushPendingOps()

		chaosMonkey: (line = 0, char = "a") ->
			orig = char
			copy = null
			pos = 0
			timer = () =>
				unless copy? and copy.length
					copy = orig.slice() + ' ' + new Date() + '\n'
					line += if Math.random() > 0.1 then 1 else -2
					line = 0 if line < 0
					pos = 0
				char = copy[0]
				copy = copy.slice(1)
				@ace.session.insert({row: line, column: pos}, char)
				pos += 1
				@_cm = setTimeout timer, 100 + if Math.random() < 0.1 then 1000 else 0
			@_cm = timer()

		clearChaosMonkey: () ->
			clearTimeout @_cm

		MAX_PENDING_OP_SIZE: 30 # pending ops bigger than this are always considered unsaved

		pollSavedStatus: () ->
			# returns false if doc has ops waiting to be acknowledged or
			# sent that haven't changed since the last time we checked.
			# Otherwise returns true.
			inflightOp = @getInflightOp()
			pendingOp = @getPendingOp()
			recentAck = @getRecentAck()
			pendingOpSize = pendingOp? && @getOpSize(pendingOp)
			if !inflightOp? and !pendingOp?
				# there's nothing going on, this is ok.
				saved = true
				sl_console.log "[pollSavedStatus] no inflight or pending ops"
			else if inflightOp? and inflightOp == @oldInflightOp
				# The same inflight op has been sitting unacked since we
				# last checked, this is bad.
				saved = false
				sl_console.log "[pollSavedStatus] inflight op is same as before"
			else if pendingOp? and recentAck && pendingOpSize < @MAX_PENDING_OP_SIZE
				# There is an op waiting to go to server but it is small and
				# within the flushDelay, this is ok for now.
				saved = true
				sl_console.log "[pollSavedStatus] pending op (small with recent ack) assume ok", pendingOp, pendingOpSize
			else
				# In any other situation, assume the document is unsaved.
				saved = false
				sl_console.log "[pollSavedStatus] assuming not saved (inflightOp?: #{inflightOp?}, pendingOp?: #{pendingOp?})"

			@oldInflightOp = inflightOp
			return saved

		_cancelLeave: () ->
			if @_leaveCallbacks?
				delete @_leaveCallbacks

		_cancelJoin: () ->
			if @_joinCallbacks?
				delete @_joinCallbacks

		_onUpdateApplied: (update) ->
			@ide.pushEvent "received-update",
				doc_id: @doc_id
				remote_doc_id: update?.doc
				wantToBeJoined: @wantToBeJoined
				update: update

			if window.disconnectOnAck? and Math.random() < window.disconnectOnAck
				sl_console.log "Disconnecting on ack", update
				window._ide.socket.socket.disconnect()
				# Pretend we never received the ack
				return

			if window.dropAcks? and Math.random() < window.dropAcks
				if !update.op? # Only drop our own acks, not collaborator updates
					sl_console.log "Simulating a lost ack", update
					return

			if update?.doc == @doc_id and @doc?
				@doc.processUpdateFromServer update

				if !@wantToBeJoined
					@leave()

		_onDisconnect: () ->
			sl_console.log '[onDisconnect] disconnecting'
			@connected = false
			@joined = false
			@doc?.updateConnectionState "disconnected"

		_onReconnect: () ->
			sl_console.log "[onReconnect] reconnected (joined project)"
			@ide.pushEvent "reconnected:afterJoinProject"

			@connected = true
			if @wantToBeJoined or @doc?.hasBufferedOps()
				sl_console.log "[onReconnect] Rejoining (wantToBeJoined: #{@wantToBeJoined} OR hasBufferedOps: #{@doc?.hasBufferedOps()})"
				@_joinDoc (error) =>
					return @_onError(error) if error?
					@doc.updateConnectionState "ok"
					@doc.flushPendingOps()
					@_callJoinCallbacks()

		_callJoinCallbacks: () ->
			for callback in @_joinCallbacks or []
				callback()
			delete @_joinCallbacks

		_joinDoc: (callback = (error) ->) ->
			if @doc?
				@ide.socket.emit 'joinDoc', @doc_id, @doc.getVersion(), (error, docLines, version, updates) =>
					return callback(error) if error?
					@joined = true
					@doc.catchUp( updates )
					callback()
			else
				@ide.socket.emit 'joinDoc', @doc_id, (error, docLines, version) =>
					return callback(error) if error?
					@joined = true
					@doc = new ShareJsDoc @doc_id, docLines, version, @ide.socket
					@_bindToShareJsDocEvents()
					callback()

		_leaveDoc: (callback = (error) ->) ->
			sl_console.log '[_leaveDoc] Sending leaveDoc request'
			@ide.socket.emit 'leaveDoc', @doc_id, (error) =>
				return callback(error) if error?
				@joined = false
				for callback in @_leaveCallbacks or []
					sl_console.log '[_leaveDoc] Calling buffered callback', callback
					callback(error)
				delete @_leaveCallbacks
				callback(error)

		_cleanUp: () ->
			if Document.openDocs[@doc_id] == @
				sl_console.log "[_cleanUp] Removing self (#{@doc_id}) from in openDocs"
				delete Document.openDocs[@doc_id]
			else
				# It's possible that this instance has error, and the doc has been reloaded.
				# This creates a new instance in Document.openDoc with the same id. We shouldn't
				# clear it because it's not this instance.
				sl_console.log "[_cleanUp] New instance of (#{@doc_id}) created. Not removing"
			@_unBindFromEditorEvents()
			@_unBindFromSocketEvents()

		_bindToShareJsDocEvents: () ->
			@doc.on "error", (error, meta) => @_onError error, meta
			@doc.on "externalUpdate", (update) => 
				@ide.pushEvent "externalUpdate",
					doc_id: @doc_id
				@trigger "externalUpdate", update
			@doc.on "remoteop", (args...) => 
				@ide.pushEvent "remoteop",
					doc_id: @doc_id
				@trigger "remoteop", args...
			@doc.on "op:sent", (op) =>
				@ide.pushEvent "op:sent",
					doc_id: @doc_id
					op: op
				@trigger "op:sent"
			@doc.on "op:acknowledged", (op) =>
				@ide.pushEvent "op:acknowledged",
					doc_id: @doc_id
					op: op
				@trigger "op:acknowledged"
			@doc.on "op:timeout", (op) =>
				@ide.pushEvent "op:timeout",
					doc_id: @doc_id
					op: op
				@trigger "op:timeout"
				@_onError new Error("op timed out"), {op: op}
			@doc.on "flush", (inflightOp, pendingOp, version) =>
				@ide.pushEvent "flush",
					doc_id: @doc_id,
					inflightOp: inflightOp,
					pendingOp: pendingOp
					v: version

		_onError: (error, meta = {}) ->
			meta.doc_id = @doc_id
			sl_console.log "ShareJS error", error, meta
			ga?('send', 'event', 'error', "shareJsError", "#{error.message} - #{@ide.socket.socket.transport.name}" )
			@doc?.clearInflightAndPendingOps()
			@trigger "error", error, meta
			# The clean up should run after the error is triggered because the error triggers a
			# disconnect. If we run the clean up first, we remove our event handlers and miss
			# the disconnect event, which means we try to leaveDoc when the connection comes back.
			# This could intefere with the new connection of a new instance of this document.
			@_cleanUp()
