load = (EventEmitter) ->
	class RangesTracker extends EventEmitter
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
		#   * Deletes by another user will consume deletes by the first user
		#   * Inserts by another user will not combine with inserts by the first user. If they are in the
		#     middle of a previous insert by the first user, the original insert will be split into two.
		constructor: (@changes = [], @comments = []) ->
			@setIdSeed(RangesTracker.generateIdSeed())

		getIdSeed: () ->
			return @id_seed

		setIdSeed: (seed) ->
			@id_seed = seed
			@id_increment = 0
		
		@generateIdSeed: () ->
			# Generate a the first 18 characters of Mongo ObjectId, leaving 6 for the increment part
			# Reference: https://github.com/dreampulse/ObjectId.js/blob/master/src/main/javascript/Objectid.js
			pid = Math.floor(Math.random() * (32767)).toString(16)
			machine = Math.floor(Math.random() * (16777216)).toString(16)
			timestamp = Math.floor(new Date().valueOf() / 1000).toString(16)
			return '00000000'.substr(0, 8 - timestamp.length) + timestamp +
				'000000'.substr(0, 6 - machine.length) + machine +
				'0000'.substr(0, 4 - pid.length) + pid
		
		@generateId: () ->
			@generateIdSeed() + "000001"

		newId: () ->
			@id_increment++
			increment = @id_increment.toString(16)
			id = @id_seed + '000000'.substr(0, 6 - increment.length) + increment;
			return id
		
		getComment: (comment_id) ->
			comment = null
			for c in @comments
				if c.id == comment_id
					comment = c
					break
			return comment
		
		removeCommentId: (comment_id) ->
			comment = @getComment(comment_id)
			return if !comment?
			@comments = @comments.filter (c) -> c.id != comment_id
			@emit "comment:removed", comment
		
		getChange: (change_id) ->
			change = null
			for c in @changes
				if c.id == change_id
					change = c
					break
			return change

		removeChangeId: (change_id) ->
			change = @getChange(change_id)
			return if !change?
			@_removeChange(change)

		applyOp: (op, metadata = {}) ->
			metadata.ts ?= new Date()
			# Apply an op that has been applied to the document to our changes to keep them up to date
			if op.i?
				@applyInsertToChanges(op, metadata)
				@applyInsertToComments(op)
			else if op.d?
				@applyDeleteToChanges(op, metadata)
				@applyDeleteToComments(op)
			else if op.c?
				@addComment(op, metadata)
			else
				throw new Error("unknown op type")
			
		addComment: (op, metadata) ->
			# TODO: Don't allow overlapping comments?
			@comments.push comment = {
				id: @newId()
				op: # Copy because we'll modify in place
					c: op.c
					p: op.p
					t: op.t
				metadata
			}
			@emit "comment:added", comment
			return comment
		
		applyInsertToComments: (op) ->
			for comment in @comments
				if op.p <= comment.op.p
					comment.op.p += op.i.length
					@emit "comment:moved", comment
				else if op.p < comment.op.p + comment.op.c.length
					offset = op.p - comment.op.p
					comment.op.c = comment.op.c[0..(offset-1)] + op.i + comment.op.c[offset...]
					@emit "comment:moved", comment

		applyDeleteToComments: (op) ->
			op_start = op.p
			op_length = op.d.length
			op_end = op.p + op_length
			for comment in @comments
				comment_start = comment.op.p
				comment_end = comment.op.p + comment.op.c.length
				comment_length = comment_end - comment_start
				if op_end <= comment_start
					# delete is fully before comment
					comment.op.p -= op_length
					@emit "comment:moved", comment
				else if op_start >= comment_end
					# delete is fully after comment, nothing to do
				else
					# delete and comment overlap
					if op_start <= comment_start
						remaining_before = ""
					else
						remaining_before = comment.op.c.slice(0, op_start - comment_start)
					if op_end >= comment_end
						remaining_after = ""
					else
						remaining_after = comment.op.c.slice(op_end - comment_start)
					
					# Check deleted content matches delete op
					deleted_comment = comment.op.c.slice(remaining_before.length, comment_length - remaining_after.length)
					offset = Math.max(0, comment_start - op_start)
					deleted_op_content = op.d.slice(offset).slice(0, deleted_comment.length)
					if deleted_comment != deleted_op_content
						throw new Error("deleted content does not match comment content")
					
					comment.op.p = Math.min(comment_start, op_start)
					comment.op.c = remaining_before + remaining_after
					@emit "comment:moved", comment

		applyInsertToChanges: (op, metadata) ->
			op_start = op.p
			op_length = op.i.length
			op_end = op.p + op_length

			already_merged = false
			previous_change = null
			moved_changes = []
			remove_changes = []
			new_changes = []
			for change in @changes
				change_start = change.op.p
				
				if change.op.d?
					# Shift any deletes after this along by the length of this insert
					if op_start < change_start
						change.op.p += op_length
						moved_changes.push change
					else if op_start == change_start
						# If the insert matches the start of the delete, just remove it from the delete instead
						if change.op.d.length >= op.i.length and change.op.d.slice(0, op.i.length) == op.i
							change.op.d = change.op.d.slice(op.i.length)
							change.op.p += op.i.length
							if change.op.d == ""
								remove_changes.push change
							else
								moved_changes.push change
							already_merged = true
						else
							change.op.p += op_length
							moved_changes.push change
				else if change.op.i?
					change_end = change_start + change.op.i.length
					is_change_overlapping = (op_start >= change_start and op_start <= change_end)
					
					# Only merge inserts if they are from the same user
					is_same_user = metadata.user_id == change.metadata.user_id
					
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
					if @track_changes and
							is_change_overlapping and
							!is_insert_blocked_by_delete and
							!already_merged and 
							is_same_user
						offset = op_start - change_start
						change.op.i = change.op.i.slice(0, offset) + op.i + change.op.i.slice(offset)
						change.metadata.ts = metadata.ts
						already_merged = true
						moved_changes.push change
					else if op_start <= change_start
						# If we're fully before the other insert we can just shift the other insert by our length.
						# If they are touching, and should have been merged, they will have been above.
						# If not merged above, then it must be blocked by a delete, and will be after this insert, so we shift it along as well
						change.op.p += op_length
						moved_changes.push change
					else if (!is_same_user or !@track_changes) and change_start < op_start < change_end
						# This user is inserting inside a change by another user, so we need to split the
						# other user's change into one before and after this one.
						offset = op_start - change_start
						before_content = change.op.i.slice(0, offset)
						after_content = change.op.i.slice(offset)
						
						# The existing change can become the 'before' change
						change.op.i = before_content
						moved_changes.push change
						
						# Create a new op afterwards
						after_change = {
							op: {
								i: after_content
								p: change_start + offset + op_length
							}
							metadata: {}
						}
						after_change.metadata[key] = value for key, value of change.metadata
						new_changes.push after_change
						
				previous_change = change

			if @track_changes and !already_merged
				@_addOp op, metadata
			for {op, metadata} in new_changes
				@_addOp op, metadata
		
			for change in remove_changes
				@_removeChange change
			
			if moved_changes.length > 0
				@emit "changes:moved", moved_changes
		
		applyDeleteToChanges: (op, metadata) ->
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
							change.metadata.ts = metadata.ts
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
					if op_end < change_start or (!@track_changes and op_end == change_start)
						# Shift ops after us back by our length.
						# If we're tracking changes, it must be strictly before, since we'll merge 
						# below if they are touching. Otherwise, touching is fine.
						change.op.p -= op_length
						moved_changes.push change
					else if op_start <= change_start <= op_end
						if @track_changes
							# If we overlap a delete, add it in our content, and delete the existing change.
							# It's easier to do it this way, rather than modifying the existing delete in case
							# we overlap many deletes and we'd need to track that. We have a workaround to
							# update the delete in place if possible below.
							offset = change_start - op_start
							op_modifications.push { i: change.op.d, p: offset }
							remove_changes.push change
						else
							change.op.p = op_start
							moved_changes.push change

			# Copy rather than modify because we still need to apply it to comments
			op = {
				p: op.p
				d: @_applyOpModifications(op.d, op_modifications)
			}

			for change in remove_changes
				# This is a bit of hack to avoid removing one delete and replacing it with another.
				# If we don't do this, it causes the UI to flicker
				if op.d.length > 0 and change.op.d? and op.p <= change.op.p <= op.p + op.d.length
					change.op.p = op.p
					change.op.d = op.d
					change.metadata = metadata
					moved_changes.push change
					op.d = "" # stop it being added
				else
					@_removeChange change

			if @track_changes and op.d.length > 0
				@_addOp op, metadata
			else
				# It's possible that we deleted an insert between two other inserts. I.e.
				# If we delete 'user_2 insert' in:
				#   |-- user_1 insert --||-- user_2 insert --||-- user_1 insert --|
				# it becomes:
				#   |-- user_1 insert --||-- user_1 insert --|
				# We need to merge these together again
				results = @_scanAndMergeAdjacentUpdates()
				moved_changes = moved_changes.concat(results.moved_changes)
				for change in results.remove_changes
					@_removeChange change
					moved_changes = moved_changes.filter (c) -> c != change
			
			if moved_changes.length > 0
				@emit "changes:moved", moved_changes

		_addOp: (op, metadata) ->
			change = {
				id: @newId()
				op: op
				metadata: metadata
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
		
		_scanAndMergeAdjacentUpdates: () ->
			# This should only need calling when deleting an update between two
			# other updates. There's no other way to get two adjacent updates from the
			# same user, since they would be merged on insert.
			previous_change = null
			remove_changes = []
			moved_changes = []
			for change in @changes
				if previous_change?.op.i? and change.op.i?
					previous_change_end = previous_change.op.p + previous_change.op.i.length
					previous_change_user_id = previous_change.metadata.user_id
					change_start = change.op.p
					change_user_id = change.metadata.user_id
					if previous_change_end == change_start and previous_change_user_id == change_user_id
						remove_changes.push change
						previous_change.op.i += change.op.i
						moved_changes.push previous_change
				else if previous_change?.op.d? and change.op.d? and previous_change.op.p == change.op.p
					# Merge adjacent deletes
					previous_change.op.d += change.op.d
					remove_changes.push change
					moved_changes.push previous_change
				else # Only update to the current change if we haven't removed it.
					previous_change = change
			return { moved_changes, remove_changes }

if define?
	define ["utils/EventEmitter"], load
else
	EventEmitter = require("events").EventEmitter
	module.exports = load(EventEmitter)