define [
	"ace/ace"
	"utils/EventEmitter"
	"ide/colors/ColorManager"
	"ide/editor/AceShareJsCodec"
], (_, EventEmitter, ColorManager, AceShareJsCodec) ->
	class TrackChangesManager
		Range = ace.require("ace/range").Range
		
		constructor: (@$scope, @editor, @element) ->
			window.trackChangesManager ?= @

			@$scope.$watch "trackChanges", (track_changes) =>
				return if !track_changes?
				@setTrackChanges(track_changes)
			
			@$scope.$watch "sharejsDoc", (doc) =>
				return if !doc?
				@disconnectFromRangesTracker()
				@rangesTracker = doc.ranges
				@connectToRangesTracker()
			
			@$scope.$on "comment:add", (e) =>
				@addCommentToSelection()

			@$scope.$on "comment:select_line", (e) =>
				@selectLineIfNoSelection()
			
			@$scope.$on "change:accept", (e, change_id) =>
				@acceptChangeId(change_id)
			
			@$scope.$on "change:reject", (e, change_id) =>
				@rejectChangeId(change_id)
			
			@$scope.$on "comment:remove", (e, comment_id) =>
				@removeCommentId(comment_id)
			
			@$scope.$on "comment:resolve", (e, comment_id, user_id) =>
				@resolveCommentId(comment_id, user_id)
			
			@$scope.$on "comment:unresolve", (e, comment_id) =>
				@unresolveCommentId(comment_id)
			
			@$scope.$on "review-panel:recalculate-screen-positions", () =>
				@recalculateReviewEntriesScreenPositions()

			changingSelection = false
			onChangeSelection = (args...) =>
				# Deletes can send about 5 changeSelection events, so
				# just act on the last one.
				if !changingSelection
					changingSelection = true
					@$scope.$evalAsync () =>
						changingSelection = false
						@updateFocus()
						@recalculateReviewEntriesScreenPositions()
			
			onResize = () =>
				@recalculateReviewEntriesScreenPositions()

			onChangeSession = (e) =>
				@redrawAnnotations()

			bindToAce = () =>
				@editor.on "changeSelection", onChangeSelection
				@editor.on "changeSession", onChangeSession
				@editor.renderer.on "resize", onResize

			unbindFromAce = () =>
				@editor.off "changeSelection", onChangeSelection
				@editor.off "changeSession", onChangeSession
				@editor.renderer.off "resize", onResize

			@$scope.$watch "trackChangesEnabled", (enabled) =>
				return if !enabled?
				if enabled
					bindToAce()
				else
					unbindFromAce()
		
		disconnectFromRangesTracker: () ->
			@changeIdToMarkerIdMap = {}

			if @rangesTracker?
				@rangesTracker.off "insert:added"
				@rangesTracker.off "insert:removed"
				@rangesTracker.off "delete:added"
				@rangesTracker.off "delete:removed"
				@rangesTracker.off "changes:moved"
				@rangesTracker.off "comment:added"
				@rangesTracker.off "comment:moved"
				@rangesTracker.off "comment:removed"
				@rangesTracker.off "comment:resolved"
				@rangesTracker.off "comment:unresolved"
				
		setTrackChanges: (value) ->
			if value
				@$scope.sharejsDoc?.track_changes_as = window.user.id
			else
				@$scope.sharejsDoc?.track_changes_as = null
		
		connectToRangesTracker: () ->
			@setTrackChanges(@$scope.trackChanges)
			
			# Add a timeout because on remote ops, we get these notifications before
			# ace has updated
			@rangesTracker.on "insert:added", (change) =>
				sl_console.log "[insert:added]", change
				setTimeout () => @_onInsertAdded(change)
			@rangesTracker.on "insert:removed", (change) =>
				sl_console.log "[insert:removed]", change
				setTimeout () => @_onInsertRemoved(change)
			@rangesTracker.on "delete:added", (change) =>
				sl_console.log "[delete:added]", change
				setTimeout () => @_onDeleteAdded(change)
			@rangesTracker.on "delete:removed", (change) =>
				sl_console.log "[delete:removed]", change
				setTimeout () => @_onDeleteRemoved(change)
			@rangesTracker.on "changes:moved", (changes) =>
				sl_console.log "[changes:moved]", changes
				setTimeout () => @_onChangesMoved(changes)

			@rangesTracker.on "comment:added", (comment) =>
				sl_console.log "[comment:added]", comment
				setTimeout () => @_onCommentAdded(comment)
			@rangesTracker.on "comment:moved", (comment) =>
				sl_console.log "[comment:moved]", comment
				setTimeout () => @_onCommentMoved(comment)
			@rangesTracker.on "comment:removed", (comment) =>
				sl_console.log "[comment:removed]", comment
				setTimeout () => @_onCommentRemoved(comment)
			@rangesTracker.on "comment:resolved", (comment) =>
				sl_console.log "[comment:resolved]", comment
				setTimeout () => @_onCommentRemoved(comment)
			@rangesTracker.on "comment:unresolved", (comment) =>
				sl_console.log "[comment:unresolved]", comment
				setTimeout () => @_onCommentAdded(comment)
			
		redrawAnnotations: () ->
			for change in @rangesTracker.changes
				if change.op.i?
					@_onInsertAdded(change)
				else if change.op.d?
					@_onDeleteAdded(change)

			for comment in @rangesTracker.comments
				@_onCommentAdded(comment)

		addComment: (offset, content) ->
			op = { c: content, p: offset }
			# @rangesTracker.applyOp op # Will apply via sharejs
			@$scope.sharejsDoc.submitOp op
		
		addCommentToSelection: () ->
			range = @editor.getSelectionRange()
			content = @editor.getSelectedText()
			offset = @_aceRangeToShareJs(range.start)
			@addComment(offset, content)
		
		selectLineIfNoSelection: () ->
			if @editor.selection.isEmpty()
				@editor.selection.selectLine()
		
		acceptChangeId: (change_id) ->
			@rangesTracker.removeChangeId(change_id)
		
		rejectChangeId: (change_id) ->
			change = @rangesTracker.getChange(change_id)
			return if !change?
			@rangesTracker.removeChangeId(change_id)
			@dont_track_next_update = true
			session = @editor.getSession()
			if change.op.d?
				content = change.op.d
				position = @_shareJsOffsetToAcePosition(change.op.p)
				session.insert(position, content)
			else if change.op.i?
				start = @_shareJsOffsetToAcePosition(change.op.p)
				end = @_shareJsOffsetToAcePosition(change.op.p + change.op.i.length)
				editor_text = session.getDocument().getTextRange({start, end})
				if editor_text != change.op.i
					throw new Error("Op to be removed (#{JSON.stringify(change.op)}), does not match editor text, '#{editor_text}'")
				session.remove({start, end})
			else
				throw new Error("unknown change: #{JSON.stringify(change)}")

		removeCommentId: (comment_id) ->
			@rangesTracker.removeCommentId(comment_id)

		resolveCommentId: (comment_id, user_id) ->
			@rangesTracker.resolveCommentId(comment_id, {
				user_id, ts: new Date()
			})
			
		unresolveCommentId: (comment_id) ->
			@rangesTracker.unresolveCommentId(comment_id)

		checkMapping: () ->
			# TODO: reintroduce this check
			session = @editor.getSession()

			# Make a copy of session.getMarkers() so we can modify it
			markers = {}
			for marker_id, marker of session.getMarkers()
				markers[marker_id] = marker

			expected_markers = []
			for change in @rangesTracker.changes
				if @changeIdToMarkerIdMap[change.id]?
					op = change.op
					{background_marker_id, callout_marker_id} = @changeIdToMarkerIdMap[change.id]
					start = @_shareJsOffsetToAcePosition(op.p)
					if op.i?
						end = @_shareJsOffsetToAcePosition(op.p + op.i.length)
					else if op.d?
						end = start
					expected_markers.push { marker_id: background_marker_id, start, end }
					expected_markers.push { marker_id: callout_marker_id, start, end: start }
			
			for comment in @rangesTracker.comments
				if @changeIdToMarkerIdMap[comment.id]?
					{background_marker_id, callout_marker_id} = @changeIdToMarkerIdMap[comment.id]
					start = @_shareJsOffsetToAcePosition(comment.op.p)
					end = @_shareJsOffsetToAcePosition(comment.op.p + comment.op.c.length)
					expected_markers.push { marker_id: background_marker_id, start, end }
					expected_markers.push { marker_id: callout_marker_id, start, end: start }
			
			for {marker_id, start, end} in expected_markers
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
			@rangesTracker.applyOp(op, metadata)
		
		updateFocus: () ->
			selection = @editor.getSelectionRange()
			cursor_offset = @_aceRangeToShareJs(selection.start)
			entries = @_getCurrentDocEntries()
			selection = !(selection.start.column == selection.end.column and selection.start.row == selection.end.row)
			@$scope.$emit "editor:focus:changed", cursor_offset, selection
		
		broadcastChange: () ->
			@$scope.$emit "editor:track-changes:changed", @$scope.docId
		
		recalculateReviewEntriesScreenPositions: () ->
			session = @editor.getSession()
			renderer = @editor.renderer
			entries = @_getCurrentDocEntries()
			for entry_id, entry of entries or {}
				doc_position = @_shareJsOffsetToAcePosition(entry.offset)
				screen_position = session.documentToScreenPosition(doc_position.row, doc_position.column)
				y = screen_position.row * renderer.lineHeight
				entry.screenPos ?= {}
				entry.screenPos.y = y
				entry.docPos = doc_position

			@$scope.$apply()
	
		_getCurrentDocEntries: () ->
			doc_id = @$scope.docId
			entries = @$scope.reviewPanel.entries[doc_id] ?= {}
			return entries

		_makeZeroWidthRange: (position) ->
			ace_range = new Range(position.row, position.column, position.row, position.column)
			# Our delete marker is zero characters wide, but Ace doesn't draw ranges
			# that are empty. So we monkey patch the range to tell Ace it's not empty.
			# We do want to claim to be empty if we're off screen after clipping rows though.
			# This is the code we need to trick:
			#   var range = marker.range.clipRows(config.firstRow, config.lastRow);
			#   if (range.isEmpty()) continue;
			ace_range.clipRows = (first_row, last_row) ->
				@isEmpty = () ->
					first_row > @end.row or last_row < @start.row
				return @
			return ace_range
		
		_createCalloutMarker: (position, klass) ->
			session = @editor.getSession()
			callout_range = @_makeZeroWidthRange(position)
			markerLayer = @editor.renderer.$markerBack
			callout_marker_id = session.addMarker callout_range, klass, (html, range, left, top, config) ->
				markerLayer.drawSingleLineMarker(html, range, "track-changes-marker-callout #{klass} ace_start", config, 0, "width: auto; right: 0;")

		_onInsertAdded: (change) ->
			start = @_shareJsOffsetToAcePosition(change.op.p)
			end = @_shareJsOffsetToAcePosition(change.op.p + change.op.i.length)
			session = @editor.getSession()
			doc = session.getDocument()
			background_range = new Range(start.row, start.column, end.row, end.column)
			background_marker_id = session.addMarker background_range, "track-changes-marker track-changes-added-marker", "text"
			callout_marker_id = @_createCalloutMarker(start, "track-changes-added-marker-callout")
			@changeIdToMarkerIdMap[change.id] = { background_marker_id, callout_marker_id }
			@broadcastChange()

		_onDeleteAdded: (change) ->
			position = @_shareJsOffsetToAcePosition(change.op.p)
			session = @editor.getSession()
			doc = session.getDocument()

			markerLayer = @editor.renderer.$markerBack
			klass = "track-changes-marker track-changes-deleted-marker"
			background_range = @_makeZeroWidthRange(position)
			background_marker_id = session.addMarker background_range, klass, (html, range, left, top, config) ->
				markerLayer.drawSingleLineMarker(html, range, "#{klass} ace_start", config, 0, "")

			callout_marker_id = @_createCalloutMarker(position, "track-changes-deleted-marker-callout")
			@changeIdToMarkerIdMap[change.id] = { background_marker_id, callout_marker_id }
			@broadcastChange()
		
		_onInsertRemoved: (change) ->
			{background_marker_id, callout_marker_id} = @changeIdToMarkerIdMap[change.id]
			delete @changeIdToMarkerIdMap[change.id]
			session = @editor.getSession()
			session.removeMarker background_marker_id
			session.removeMarker callout_marker_id
			@broadcastChange()
		
		_onDeleteRemoved: (change) ->
			{background_marker_id, callout_marker_id} = @changeIdToMarkerIdMap[change.id]
			delete @changeIdToMarkerIdMap[change.id]
			session = @editor.getSession()
			session.removeMarker background_marker_id
			session.removeMarker callout_marker_id
			@broadcastChange()
		
		_onCommentAdded: (comment) ->
			if !@changeIdToMarkerIdMap[comment.id]?
				# Only create new markers if they don't already exist
				start = @_shareJsOffsetToAcePosition(comment.op.p)
				end = @_shareJsOffsetToAcePosition(comment.op.p + comment.op.c.length)
				session = @editor.getSession()
				doc = session.getDocument()
				background_range = new Range(start.row, start.column, end.row, end.column)
				background_marker_id = session.addMarker background_range, "track-changes-marker track-changes-comment-marker", "text"
				callout_marker_id = @_createCalloutMarker(start, "track-changes-comment-marker-callout")
				@changeIdToMarkerIdMap[comment.id] = { background_marker_id, callout_marker_id }
			@broadcastChange()
		
		_onCommentRemoved: (comment) ->
			if @changeIdToMarkerIdMap[comment.id]?
				# Resolved comments may not have marker ids
				{background_marker_id, callout_marker_id} = @changeIdToMarkerIdMap[comment.id]
				delete @changeIdToMarkerIdMap[comment.id]
				session = @editor.getSession()
				session.removeMarker background_marker_id
				session.removeMarker callout_marker_id
			@broadcastChange()

		_aceRangeToShareJs: (range) ->
			lines = @editor.getSession().getDocument().getLines 0, range.row
			return AceShareJsCodec.aceRangeToShareJs(range, lines)

		_aceChangeToShareJs: (delta) ->
			lines = @editor.getSession().getDocument().getLines 0, delta.start.row
			return AceShareJsCodec.aceChangeToShareJs(delta, lines)
		
		_shareJsOffsetToAcePosition: (offset) ->
			lines = @editor.getSession().getDocument().getAllLines()
			return AceShareJsCodec.shareJsOffsetToAcePosition(offset, lines)
		
		_onChangesMoved: (changes) ->
			# TODO: PERFORMANCE: Only run through the Ace lines once, and calculate all
			# change positions as we go.
			for change in changes
				start = @_shareJsOffsetToAcePosition(change.op.p)
				if change.op.i?
					end = @_shareJsOffsetToAcePosition(change.op.p + change.op.i.length)
				else
					end = start
				@_updateMarker(change.id, start, end)
			@editor.renderer.updateBackMarkers()
			@broadcastChange()
		
		_onCommentMoved: (comment) ->
			start = @_shareJsOffsetToAcePosition(comment.op.p)
			end = @_shareJsOffsetToAcePosition(comment.op.p + comment.op.c.length)
			@_updateMarker(comment.id, start, end)
			@editor.renderer.updateBackMarkers()
			@broadcastChange()
	
		_updateMarker: (change_id, start, end) ->
			return if !@changeIdToMarkerIdMap[change_id]?
			session = @editor.getSession()
			markers = session.getMarkers()
			{background_marker_id, callout_marker_id} = @changeIdToMarkerIdMap[change_id]
			if background_marker_id?
				background_marker = markers[background_marker_id]
				background_marker.range.start = start
				background_marker.range.end = end
			if callout_marker_id?
				callout_marker = markers[callout_marker_id]
				callout_marker.range.start = start
				callout_marker.range.end = start

