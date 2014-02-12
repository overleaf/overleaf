define () ->
	class CursorManager
		UPDATE_INTERVAL: 500

		constructor: (@ide) ->
			@clients = {}
			@ide.socket.on "clientTracking.clientUpdated", (cursorUpdate) => @onRemoteClientUpdate(cursorUpdate)
			@ide.socket.on "clientTracking.clientDisconnected", (client_id) => @onRemoteClientDisconnect(client_id)
			@ide.editor.on "change:doc", (session) =>
				@bindToAceSession(session)
			@ide.editor.on "mousemove", (e) =>
				@mousePosition = e.position
				@updateVisibleNames()

		bindToAceSession: (session) ->
			@clients = {}
			@ide.editor.aceEditor.on "changeSelection", => @onLocalCursorUpdate()

		onLocalCursorUpdate: () ->
			if !@cursorUpdateTimeout?
				@cursorUpdateTimeout = setTimeout (=>
					@_sendLocalCursorUpdate()
					delete @cursorUpdateTimeout
				), @UPDATE_INTERVAL

		_sendLocalCursorUpdate: () ->
			cursor = @ide.editor.getCursorPosition()
			if !@currentCursorPosition? or not (cursor.row == @currentCursorPosition.row and cursor.column == @currentCursorPosition.column)
				@currentCursorPosition = cursor
				@ide.socket.emit "clientTracking.updatePosition", {
					row: cursor.row
					column: cursor.column
					doc_id: @ide.editor.getCurrentDocId()
				}

		onRemoteClientUpdate: (clientData) ->
			if clientData.id != ide.socket.socket.sessionid
				client = @clients[clientData.id] ||= {}
				client.row = clientData.row
				client.column = clientData.column
				client.name = clientData.name
				client.doc_id = clientData.doc_id
				@redrawCursors()

		onRemoteClientDisconnect: (client_id) ->
			@removeCursor(client_id)
			delete @clients[client_id]

		removeCursor: (client_id) ->
			client = @clients[client_id]
			return if !client?
			@ide.editor.removeMarker(client.cursorMarkerId)
			delete client.cursorMarkerId

		redrawCursors: () ->
			for clientId, clientData of @clients
				do (clientId, clientData) =>
					if clientData.cursorMarkerId?
						@removeCursor(clientId)
					if clientData.doc_id == @ide.editor.getCurrentDocId()
						colorId = @getColorIdFromName(clientData.name)
						clientData.cursorMarkerId = @ide.editor.addMarker {
								row: clientData.row
								column: clientData.column
								length: 1
							}, "sharelatex-remote-cursor", (html, range, left, top, config) ->
								div = """
									<div
										id='cursor-#{clientId}'
										class='sharelatex-remote-cursor custom ace_start sharelatex-remote-cursor-#{colorId}'
										style='height: #{config.lineHeight}px; top:#{top}px; left:#{left}px;'
									>
										<div class="nubbin" style="bottom: #{config.lineHeight - 2}px"></div>
										<div class="name" style="display: none; bottom: #{config.lineHeight - 2}px">#{$('<div/>').text(clientData.name).html()}</div>
									</div>
								"""
								html.push div
							, true
			setTimeout =>
				@updateVisibleNames()
			, 0

		updateVisibleNames: () ->
			for clientId, clientData of @clients
				if @mousePosition? and clientData.row == @mousePosition.row and clientData.column == @mousePosition.column
					$("#cursor-#{clientId}").find(".name").show()
					$("#cursor-#{clientId}").find(".nubbin").hide()
				else
					$("#cursor-#{clientId}").find(".name").hide()
					$("#cursor-#{clientId}").find(".nubbin").show()

		getColorIdFromName: (name) ->
			@currentColorId ||= 0
			@colorIds ||= {}
			if !@colorIds[name]?
				@colorIds[name] = @currentColorId
				@currentColorId++
			return @colorIds[name]
		
