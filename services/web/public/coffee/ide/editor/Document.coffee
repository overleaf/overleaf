define [
	"utils/EventEmitter"
	"ide/editor/ShareJsDoc"
], (EventEmitter, ShareJsDoc) ->
	class Document extends EventEmitter
		@getDocument: (ide, doc_id) ->
			@openDocs ||= {}
			if !@openDocs[doc_id]?
				@openDocs[doc_id] = new Document(ide, doc_id)
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
				@_leaveCallbacks ||= []
				@_leaveCallbacks.push callback
			else if !@connected
				callback()
			else
				@_leaveDoc(callback)

		flush: () ->
			@doc?.flushPendingOps()

		pollSavedStatus: () ->
			# returns false if doc has ops waiting to be acknowledged or
			# sent that haven't changed since the last time we checked.
			# Otherwise returns true.
			inflightOp = @getInflightOp()
			pendingOp = @getPendingOp()
			if !inflightOp? and !pendingOp?
				# there's nothing going on
				saved = true
			else if inflightOp == @oldInflightOp
				saved = false
			else if pendingOp?
				saved = false
			else
				saved = true

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

			if window.dropAcks? and Math.random() < window.dropAcks
				if !update.op? # Only drop our own acks, not collaborator updates
					console.log "Simulating a lost ack", update
					return

			if update?.doc == @doc_id and @doc?
				@doc.processUpdateFromServer update

				if !@wantToBeJoined
					@leave()

		_onDisconnect: () ->
			@connected = false
			@joined = false
			@doc?.updateConnectionState "disconnected"

		_onReconnect: () ->
			@ide.pushEvent "reconnected:afterJoinProject"

			@connected = true
			if @wantToBeJoined or @doc?.hasBufferedOps()
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
			@ide.socket.emit 'leaveDoc', @doc_id, (error) =>
				return callback(error) if error?
				@joined = false
				for callback in @_leaveCallbacks or []
					callback(error)
				delete @_leaveCallbacks
				callback(error)

		_cleanUp: () ->
			delete Document.openDocs[@doc_id]
			@_unBindFromEditorEvents()
			@_unBindFromSocketEvents()

		_bindToShareJsDocEvents: () ->
			@doc.on "error", (error, meta) => @_onError error, meta
			@doc.on "externalUpdate", (update) => 
				@ide.pushEvent "externalUpdate",
					doc_id: @doc_id
				@trigger "externalUpdate", update
			@doc.on "remoteop", () => 
				@ide.pushEvent "remoteop",
					doc_id: @doc_id
				@trigger "remoteop"
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
				ga?('send', 'event', 'error', "op timeout", "Op was now acknowledged - #{@ide.socket.socket.transport.name}" )
				@ide.connectionManager.reconnectImmediately()
			@doc.on "flush", (inflightOp, pendingOp, version) =>
				@ide.pushEvent "flush",
					doc_id: @doc_id,
					inflightOp: inflightOp,
					pendingOp: pendingOp
					v: version

		_onError: (error, meta = {}) ->
			meta.doc_id = @doc_id
			console.error "ShareJS error", error, meta
			ga?('send', 'event', 'error', "shareJsError", "#{error.message} - #{@ide.socket.socket.transport.name}" )
			@doc?.clearInflightAndPendingOps()
			@_cleanUp()
			@trigger "error", error, meta
