define [
	"ace/ace"
	"utils/EventEmitter"
], (_, EventEmitter) ->
	class TrackChangesManager
		Range = ace.require("ace/range").Range
		
		constructor: (@$scope, @editor, @element) ->
			@changesTracker = new ChangesTracker()
			@changeIdToMarkerIdMap = {}
			@enabled = false
			console.log "Track Changes", @$scope.reviewPanel

			@changesTracker.on "insert:added", (change) =>
				@_onInsertAdded(change)
			@changesTracker.on "insert:removed", (change) =>
				@_onInsertRemoved(change)
			@changesTracker.on "delete:added", (change) =>
				@_onDeleteAdded(change)
			@changesTracker.on "delete:removed", (change) =>
				@_onDeleteRemoved(change)
			@changesTracker.on "changes:moved", (changes) =>
				@_onChangesMoved(changes)

			onChange = (e) =>
				if !@editor.initing and @enabled
					@applyChange(e)
					setTimeout () =>
						@checkMapping()
					, 100
			
			# onScroll = () =>
			# 	@recalculateReviewEntriesScreenPositions()

			@editor.on "changeSession", (e) =>
				e.oldSession?.getDocument().off "change", onChange
				e.session.getDocument().on "change", onChange
				# e.oldSession?.off "changeScrollTop", onScroll
				# e.session.on "changeScrollTop", onScroll
			@editor.getSession().getDocument().on "change", onChange
			# @editor.getSession().on "changeScrollTop", onScroll

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
		
		applyChange: (delta) ->
			op = @_aceChangeToShareJs(delta)
			@changesTracker.applyOp(op)
		
		updateReviewEntriesScope: () ->
			# TODO: Update in place so Angular doesn't have to redo EVERYTHING
			@$scope.reviewPanel.entries = {}
			for change in @changesTracker.changes
				@$scope.reviewPanel.entries[change.id] = {
					content: change.op.i or change.op.d
					offset: change.op.p
				}
			@recalculateReviewEntriesScreenPositions()
		
		recalculateReviewEntriesScreenPositions: () ->
			session = @editor.getSession()
			renderer = @editor.renderer
			for entry_id, entry of @$scope.reviewPanel.entries
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
			marker_id = session.addMarker(ace_range, "track-changes-added-marker", "text")
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

			marker_id = session.addMarker(ace_range, "track-changes-deleted-marker", "text")
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
		
		_aceChangeToShareJs: (delta) ->
			start = delta.start
			lines = @editor.getSession().getDocument().getLines 0, start.row
			offset = 0
			for line, i in lines
				offset += if i < start.row
					line.length
				else
					start.column
			offset += start.row # Include newlines

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
			@updateReviewEntriesScope()
	
	class ChangesTracker extends EventEmitter
		# The purpose of this class is to track a set of inserts and deletes to a document, like
		# track changes in Word. We store these as a set of ShareJs style ranges:
		#   {i: "foo", p: 42} # Insert 'foo' at offset 42
		#   {d: "bar", p: 37} # Delete 'bar' at offset 37
		# We only track the inserts and deletes, not the whole document, but by being given all
		# updates that are applied to a document, we can update these appropriately.
		# 
		# Note that the set of inserts and deletes we store applies to the document as-is at the moment.
		# So inserts correspond to text which is in the document, while deletes correspond to text which
		# is no longer there, so their lengths do not affect the position of later offsets.
		# E.g.
		#             this is the current text of the document
		#                         |-----|            |
		#  {i: "current ", p:12} -^                   ^- {d: "old ", p: 31}
		#
		# Track changes rules (should be consistent with Word):
		#   * When text is inserted at a delete, the text goes to the left of the delete
		#       I.e. "foo|bar" -> "foobaz|bar", where | is the delete, and 'baz' is inserted
		#   * Deleting content flagged as 'inserted' does not create a new delete marker, it only
		#     removes the insert marker. E.g.
		#       * "abdefghijkl"        -> "abfghijkl"        when 'de' is deleted. No delete marker added
		#           |---| <- inserted       |-| <- inserted
		#       * Deletes overlapping regular text and inserted text will insert a delete marker for the
		#         regular text:
		#         "abcdefghijkl"    ->    "abcdejkl"   when 'fghi' is deleted
		#           |----|                  |--||
		#           ^- inserted 'bcdefg'      \ ^- deleted 'hi'
		#                                      \--inserted 'bcde'
		#   * Deletes overlapping other deletes are merged. E.g.
		#      "abcghijkl"        ->   "ahijkl"     when 'bcg is deleted'
		#          | <- delete 'def'     | <- delete 'bcdefg'
		constructor: () ->
			# Change objects have the following structure:
			# {
			#   id: ... # Uniquely generated by us
			#   op: { # ShareJs style op tracking the offset (p) and content inserted (i) or deleted (d)
			#     i: "..."
			#     p: 42
			#   }
			# }
			#
			# Ids are used to uniquely identify a change, e.g. for updating it in the database, or keeping in
			# sync with Ace ranges.
			@changes = []
			@id = 0
		
		applyOp: (op) ->
			# Apply an op that has been applied to the document to our changes to keep them up to date
			if op.i?
				@applyInsert(op)
			else if op.d?
				@applyDelete(op)
			
		applyInsert: (op) ->
			op_start = op.p
			op_length = op.i.length
			op_end = op.p + op_length

			already_merged = false
			previous_change = null
			moved_changes = []
			for change in @changes
				change_start = change.op.p
				
				if change.op.d?
					# Shift any deletes after this along by the length of this insert
					if op_start <= change_start
						change.op.p += op_length
						moved_changes.push change
				else if change.op.i?
					change_end = change_start + change.op.i.length
					is_change_overlapping = (op_start >= change_start and op_start <= change_end)
					
					# If there is a delete at the start of the insert, and we're inserting
					# at the start, we SHOULDN'T merge since the delete acts as a partition.
					# The previous op will be the delete, but it's already been shifted by this insert
					#
					# I.e.
					# Originally: |-- existing insert --|
					#             | <- existing delete at same offset
					#
					# Now:        |-- existing insert --| <- not shifted yet
					#             |-- this insert --|| <- existing delete shifted along to end of this op
					# 
					# After:                         |-- existing insert --|  
					#             |-- this insert --|| <- existing delete
					# 
					# Without the delete, the inserts would be merged.
					is_insert_blocked_by_delete = (previous_change? and previous_change.op.d? and previous_change.op.p == op_end)

					# If the insert is overlapping another insert, either at the beginning in the middle or touching the end,
					# then we merge them into one.
					if is_change_overlapping and
							!is_insert_blocked_by_delete and
							!already_merged # With the way we order our changes, there should only ever be one candidate to merge
							                # with since changes don't overlap. However, this flag just adds a little bit of protection
						offset = op_start - change_start
						change.op.i = change.op.i.slice(0, offset) + op.i + change.op.i.slice(offset)
						already_merged = true
						moved_changes.push change
					else if op_start <= change_start
						# If we're fully before the other insert we can just shift the other insert by our length.
						# If they are touching, and should have been merged, they will have been above.
						# If not merged above, then it must be blocked by a delete, and will be after this insert, so we shift it along as well
						change.op.p += op_length
						moved_changes.push change
				previous_change = change

			if !already_merged
				@_addOp op
			
			if moved_changes.length > 0
				@emit "changes:moved", moved_changes
		
		applyDelete: (op) ->
			op_start = op.p
			op_length = op.d.length
			op_end = op.p + op_length
			remove_changes = []
			moved_changes = []
			
			# We might end up modifying our delete op if it merges with existing deletes, or cancels out
			# with an existing insert. Since we might do multiple modifications, we record them and do
			# all the modifications after looping through the existing changes, so as not to mess up the
			# offset indexes as we go.
			op_modifications = []
			for change in @changes
				if change.op.i?
					change_start = change.op.p
					change_end = change_start + change.op.i.length
					if op_end <= change_start
						# Shift ops after us back by our length
						change.op.p -= op_length
						moved_changes.push change
					else if op_start >= change_end
						# Delete is after insert, nothing to do
					else
						# When the new delete overlaps an insert, we should remove the part of the insert that
						# is now deleted, and also remove the part of the new delete that overlapped. I.e.
						# the two cancel out where they overlap.
						if op_start >= change_start
							#                            |-- existing insert --|
							# insert_remaining_before -> |.....||--   new delete   --|
							delete_remaining_before = ""
							insert_remaining_before = change.op.i.slice(0, op_start - change_start)
						else
							# delete_remaining_before -> |.....||-- existing insert --|
							#                            |-- new delete   --|
							delete_remaining_before = op.d.slice(0, change_start - op_start)
							insert_remaining_before = ""

						if op_end <= change_end
							#    |--  existing insert  --|
							# |--  new delete   --||.....| <- insert_remaining_after
							delete_remaining_after = ""
							insert_remaining_after = change.op.i.slice(op_end - change_start)
						else
							# |--  existing insert  --||.....| <- delete_remaining_after
							#            |--  new delete   --|
							delete_remaining_after = op.d.slice(change_end - op_start)
							insert_remaining_after = ""

						insert_remaining = insert_remaining_before + insert_remaining_after
						if insert_remaining.length > 0
							change.op.i = insert_remaining
							change.op.p = Math.min(change_start, op_start)
							moved_changes.push change
						else
							remove_changes.push change

						# We know what we want to preserve of our delete op before (delete_remaining_before) and what we want to preserve
						# afterwards (delete_remaining_before). Now we need to turn that into a modification which deletes the 
						# chunk in the middle not covered by these.
						delete_removed_length = op.d.length - delete_remaining_before.length - delete_remaining_after.length
						delete_removed_start = delete_remaining_before.length
						modification = {
							d: op.d.slice(delete_removed_start, delete_removed_start + delete_removed_length)
							p: delete_removed_start
						}
						if modification.d.length > 0
							op_modifications.push modification
				else if change.op.d?
					change_start = change.op.p
					if op_end < change_start
						# Shift ops after us (but not touching) back by our length
						change.op.p -= op_length
						moved_changes.push change
					else if op_start <= change_start <= op_end
						# If we overlap a delete, add it in our content, and delete the existing change
						offset = change_start - op_start
						op_modifications.push { i: change.op.d, p: offset }
						remove_changes.push change
			
			op.d = @_applyOpModifications(op.d, op_modifications)
			if op.d.length > 0
				@_addOp op

			for change in remove_changes
				@_removeChange change
			
			if moved_changes.length > 0
				@emit "changes:moved", moved_changes

		_newId: () ->
			@id++

		_addOp: (op) ->
			change = {
				id: @_newId()
				op: op
			}
			@changes.push change

			# Keep ops in order of offset, with deletes before inserts
			@changes.sort (c1, c2) ->
				result = c1.op.p - c2.op.p
				if result != 0
					return result
				else if c1.op.i? and c2.op.d?
					return 1
				else
					return -1

			if op.d?
				@emit "delete:added", change
			else if op.i?
				@emit "insert:added", change
		
		_removeChange: (change) ->
			@changes = @changes.filter (c) -> c.id != change.id
			if change.op.d?
				@emit "delete:removed", change
			else if change.op.i?
				@emit "insert:removed", change
			
		_applyOpModifications: (content, op_modifications) ->
			# Put in descending position order, with deleting first if at the same offset 
			# (Inserting first would modify the content that the delete will delete)
			op_modifications.sort (a, b) ->
				result = b.p - a.p 
				if result != 0
					return result
				else if a.i? and b.d?
					return 1
				else
					return -1

			for modification in op_modifications
				if modification.i?
					content = content.slice(0, modification.p) + modification.i + content.slice(modification.p)
				else if modification.d?
					if content.slice(modification.p, modification.p + modification.d.length) != modification.d
						throw new Error("deleted content does not match. content: #{JSON.stringify(content)}; modification: #{JSON.stringify(modification)}")
					content = content.slice(0, modification.p) + content.slice(modification.p + modification.d.length)
			return content

	return TrackChangesManager