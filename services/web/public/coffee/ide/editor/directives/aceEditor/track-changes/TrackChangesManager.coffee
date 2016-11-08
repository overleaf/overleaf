define [
	"ace/ace"
	"utils/EventEmitter"
	"ide/editor/directives/aceEditor/track-changes/ChangesTracker"
	"ide/colors/ColorManager"
], (_, EventEmitter, ChangesTracker, ColorManager) ->
	class TrackChangesManager
		Range = ace.require("ace/range").Range
		
		constructor: (@$scope, @editor, @element) ->
			@changesTracker = new ChangesTracker()
			@changesTracker.track_changes = true
			@changeIdToMarkerIdMap = {}
			@enabled = false
			window.trackChangesManager ?= @

			@changesTracker.on "insert:added", (change) =>
				sl_console.log "[insert:added]", change
				@_onInsertAdded(change)
			@changesTracker.on "insert:removed", (change) =>
				sl_console.log "[insert:removed]", change
				@_onInsertRemoved(change)
			@changesTracker.on "delete:added", (change) =>
				sl_console.log "[delete:added]", change
				@_onDeleteAdded(change)
			@changesTracker.on "delete:removed", (change) =>
				sl_console.log "[delete:removed]", change
				@_onDeleteRemoved(change)
			@changesTracker.on "changes:moved", (changes) =>
				sl_console.log "[changes:moved]", changes
				@_onChangesMoved(changes)

			@changesTracker.on "comment:added", (comment) =>
				sl_console.log "[comment:added]", comment
				@_onCommentAdded(comment)
			@changesTracker.on "comment:moved", (comment) =>
				sl_console.log "[comment:moved]", comment
				@_onCommentMoved(comment)

			onChange = (e) =>
				if !@editor.initing and @enabled
					# This change is trigger by a sharejs 'change' event, which is before the
					# sharejs 'remoteop' event. So wait until the next event loop when the 'remoteop'
					# will have fired, before we decide if it was a remote op.
					setTimeout () =>
						if @nextUpdateMetaData?
							user_id = @nextUpdateMetaData.user_id
							# The remote op may have contained multiple atomic ops, each of which is an Ace
							# 'change' event (i.e. bulk commenting out of lines is a single remote op
							# but gives us one event for each % inserted). These all come in a single event loop
							# though, so wait until the next one before clearing the metadata.
							setTimeout () =>
								@nextUpdateMetaData = null
						else
							user_id = window.user.id

						@applyChange(e, { user_id })
						
						# TODO: Just for debugging, remove before going live.
						setTimeout () =>
							@checkMapping()
						, 100

			@editor.on "changeSession", (e) =>
				e.oldSession?.getDocument().off "change", onChange
				e.session.getDocument().on "change", onChange
			@editor.getSession().getDocument().on "change", onChange
			
			@editor.renderer.on "resize", () =>
				@recalculateReviewEntriesScreenPositions()

		addComment: (offset, length, comment) ->
			@changesTracker.addComment offset, length, {
				comment: comment
				user_id: window.user_id
			}
		
		addCommentToSelection: (comment) ->
			range = @editor.getSelectionRange()
			offset = @_aceRangeToShareJs(range.start)
			end = @_aceRangeToShareJs(range.end)
			length = end - offset
			@addComment(offset, length, comment)

		checkMapping: () ->
			session = @editor.getSession()

			# Make a copy of session.getMarkers() so we can modify it
			markers = {}
			for marker_id, marker of session.getMarkers()
				markers[marker_id] = marker

			for change in @changesTracker.changes
				op = change.op
				marker_id = @changeIdToMarkerIdMap[change.id]
				
				start = @_shareJsOffsetToAcePosition(op.p)
				if op.i?
					end = @_shareJsOffsetToAcePosition(op.p + op.i.length)
				else if op.d?
					end = start
					
				marker = markers[marker_id]
				delete markers[marker_id]
				if marker.range.start.row != start.row or
						marker.range.start.column != start.column or
						marker.range.end.row != end.row or
						marker.range.end.column != end.column
					console.error "Change doesn't match marker anymore", {change, marker, start, end}
			
			for marker_id, marker of markers
				if marker.clazz.match("track-changes")
					console.error "Orphaned ace marker", marker
		
		applyChange: (delta, metadata) ->
			op = @_aceChangeToShareJs(delta)
			@changesTracker.applyOp(op, metadata)
		
		updateReviewEntriesScope: () ->
			# TODO: Update in place so Angular doesn't have to redo EVERYTHING
			@$scope.reviewPanel.entries = {}
			for change in @changesTracker.changes
				@$scope.reviewPanel.entries[change.id] = {
					content: change.op.i or change.op.d
					offset: change.op.p
				}
			for comment in @changesTracker.comments
				@$scope.reviewPanel.entries[comment.id] = {
					content: comment.metadata.comment
					offset: comment.offset
				}
				
			@recalculateReviewEntriesScreenPositions()
		
		recalculateReviewEntriesScreenPositions: () ->
			session = @editor.getSession()
			renderer = @editor.renderer
			for entry_id, entry of (@$scope.reviewPanel?.entries or {})
				doc_position = @_shareJsOffsetToAcePosition(entry.offset)
				screen_position = session.documentToScreenPosition(doc_position.row, doc_position.column)
				y = screen_position.row * renderer.lineHeight
				entry.screenPos = { y }
			@$scope.$apply()
				
		_onInsertAdded: (change) ->
			start = @_shareJsOffsetToAcePosition(change.op.p)
			end = @_shareJsOffsetToAcePosition(change.op.p + change.op.i.length)
			session = @editor.getSession()
			doc = session.getDocument()
			ace_range = new Range(start.row, start.column, end.row, end.column)

			hue = ColorManager.getHueForUserId(change.metadata.user_id)
			colorScheme = ColorManager.getColorScheme(hue, @element)
			markerLayer = @editor.renderer.$markerBack
			klass = "track-changes-added-marker"
			style = "border-color: #{colorScheme.cursor}"
			marker_id = session.addMarker ace_range, klass, (html, range, left, top, config) ->
				if range.isMultiLine()
					markerLayer.drawTextMarker(html, range, klass, config, style)
				else
					markerLayer.drawSingleLineMarker(html, range, "#{klass} ace_start", config, 0, style)
			
			@changeIdToMarkerIdMap[change.id] = marker_id
			@updateReviewEntriesScope()
		
		_onDeleteAdded: (change) ->
			position = @_shareJsOffsetToAcePosition(change.op.p)
			session = @editor.getSession()
			doc = session.getDocument()
			ace_range = new Range(position.row, position.column, position.row, position.column)
			
			# Our delete marker is zero characters wide, but Ace doesn't draw ranges
			# that are empty. So we monkey patch the range to tell Ace it's not empty.
			# This is the code we need to trick:
			#   var range = marker.range.clipRows(config.firstRow, config.lastRow);
			#   if (range.isEmpty()) continue;
			_clipRows = ace_range.clipRows
			ace_range.clipRows = (args...) ->
				range = _clipRows.apply(ace_range, args)
				range.isEmpty = () ->
					false
				return range

			hue = ColorManager.getHueForUserId(change.metadata.user_id)
			colorScheme = ColorManager.getColorScheme(hue, @element)
			markerLayer = @editor.renderer.$markerBack
			klass = "track-changes-deleted-marker"
			style = "border-color: #{colorScheme.cursor}"
			marker_id = session.addMarker ace_range, klass, (html, range, left, top, config) ->
				markerLayer.drawSingleLineMarker(html, range, "#{klass} ace_start", config, 0, style)

			@changeIdToMarkerIdMap[change.id] = marker_id
			@updateReviewEntriesScope()
		
		_onInsertRemoved: (change) ->
			marker_id = @changeIdToMarkerIdMap[change.id]
			session = @editor.getSession()
			session.removeMarker marker_id
			@updateReviewEntriesScope()
		
		_onDeleteRemoved: (change) ->
			marker_id = @changeIdToMarkerIdMap[change.id]
			session = @editor.getSession()
			session.removeMarker marker_id
			@updateReviewEntriesScope()
		
		_onCommentAdded: (comment) ->
			start = @_shareJsOffsetToAcePosition(comment.offset)
			end = @_shareJsOffsetToAcePosition(comment.offset + comment.length)
			session = @editor.getSession()
			doc = session.getDocument()
			ace_range = new Range(start.row, start.column, end.row, end.column)

			hue = ColorManager.getHueForUserId(comment.metadata.user_id)
			colorScheme = ColorManager.getColorScheme(hue, @element)
			markerLayer = @editor.renderer.$markerBack
			klass = "track-changes-comment-marker"
			style = "border-color: #{colorScheme.cursor}"
			marker_id = session.addMarker ace_range, klass, (html, range, left, top, config) ->
				if range.isMultiLine()
					markerLayer.drawTextMarker(html, range, klass, config, style)
				else
					markerLayer.drawSingleLineMarker(html, range, "#{klass} ace_start", config, 0, style)
			
			@changeIdToMarkerIdMap[comment.id] = marker_id
			@updateReviewEntriesScope()
		
		_onCommentMoved: (comment) ->
			start = @_shareJsOffsetToAcePosition(comment.offset)
			end = @_shareJsOffsetToAcePosition(comment.offset + comment.length)
			session = @editor.getSession()
			ace_range = new Range(start.row, start.column, end.row, end.column)
			marker_id = @changeIdToMarkerIdMap[comment.id]
			markers = session.getMarkers()
			marker = markers[marker_id]
			marker.range.start = start
			marker.range.end = end
			@editor.renderer.updateBackMarkers()
			@updateReviewEntriesScope()

		_aceRangeToShareJs: (range) ->
			lines = @editor.getSession().getDocument().getLines 0, range.row
			offset = 0
			for line, i in lines
				offset += if i < range.row
					line.length
				else
					range.column
			offset += range.row # Include newlines

		_aceChangeToShareJs: (delta) ->
			offset = @_aceRangeToShareJs(delta.start)

			text = delta.lines.join('\n')
			switch delta.action
				when 'insert'
					return { i: text, p: offset }
				when 'remove'
					return { d: text, p: offset }
				else throw new Error "unknown action: #{delta.action}"
		
		_shareJsOffsetToAcePosition: (offset) ->
			lines = @editor.getSession().getDocument().getAllLines()
			row = 0
			for line, row in lines
				break if offset <= line.length
				offset -= lines[row].length + 1 # + 1 for newline char
			return {row:row, column:offset}
		
		_onChangesMoved: (changes) ->
			session = @editor.getSession()
			markers = session.getMarkers()
			# TODO: PERFORMANCE: Only run through the Ace lines once, and calculate all
			# change positions as we go.
			for change in changes
				start = @_shareJsOffsetToAcePosition(change.op.p)
				if change.op.i?
					end = @_shareJsOffsetToAcePosition(change.op.p + change.op.i.length)
				else
					end = start
				marker_id = @changeIdToMarkerIdMap[change.id]
				marker = markers[marker_id]
				marker.range.start = start
				marker.range.end = end
			@editor.renderer.updateBackMarkers()
			@updateReviewEntriesScope()
