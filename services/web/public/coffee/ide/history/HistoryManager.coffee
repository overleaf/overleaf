define [
	"moment"
	"ide/colors/ColorManager"
	"ide/history/controllers/HistoryListController"
	"ide/history/controllers/HistoryDiffController"
	"ide/history/directives/infiniteScroll"
], (moment, ColorManager) ->
	class HistoryManager
		constructor: (@ide, @$scope) ->
			@reset()

			@$scope.toggleHistory = () =>
				if @$scope.ui.view == "history"
					@hide()
				else
					@show()

			@$scope.$watch "history.selection.updates", (updates) =>
				if updates? and updates.length > 0
					@_selectDocFromUpdates()
					@reloadDiff()

			@$scope.$on "entity:selected", (event, entity) =>
				if (@$scope.ui.view == "history") and (entity.type == "doc")
					@$scope.history.selection.doc = entity
					@reloadDiff()

		show: () ->
			@$scope.ui.view = "history"
			@reset()

		hide: () ->
			@$scope.ui.view = "editor"
			# Make sure we run the 'open' logic for whatever is currently selected
			@$scope.$emit "entity:selected", @ide.fileTreeManager.findSelectedEntity()

		reset: () ->
			@$scope.history = {
				updates: []
				nextBeforeTimestamp: null
				atEnd: false
				selection: {
					updates: []
					doc: null
					range: {
						fromV: null
						toV: null
						start_ts: null
						end_ts: null
					}
				}
				diff: null
			}

		autoSelectRecentUpdates: () ->
			return if @$scope.history.updates.length == 0

			@$scope.history.updates[0].selectedTo = true

			indexOfLastUpdateNotByMe = 0
			for update, i in @$scope.history.updates
				if @_updateContainsUserId(update, @$scope.user.id)
					break
				indexOfLastUpdateNotByMe = i

			@$scope.history.updates[indexOfLastUpdateNotByMe].selectedFrom = true

		BATCH_SIZE: 10
		fetchNextBatchOfUpdates: () ->
			url = "/project/#{@ide.project_id}/updates?min_count=#{@BATCH_SIZE}"
			if @$scope.history.nextBeforeTimestamp?
				url += "&before=#{@$scope.history.nextBeforeTimestamp}"
			@$scope.history.loading = true
			@ide.$http
				.get(url)
				.success (data) =>
					@_loadUpdates(data.updates)
					@$scope.history.nextBeforeTimestamp = data.nextBeforeTimestamp
					if !data.nextBeforeTimestamp?
						@$scope.history.atEnd = true
					@$scope.history.loading = false

		reloadDiff: () ->
			diff = @$scope.history.diff
			{updates, doc} = @$scope.history.selection
			{fromV, toV, start_ts, end_ts}   = @_calculateRangeFromSelection()

			return if !doc?

			return if diff? and
				diff.doc   == doc   and
				diff.fromV == fromV and
				diff.toV   == toV

			@$scope.history.diff = diff = {
				fromV:    fromV
				toV:      toV
				start_ts: start_ts
				end_ts:   end_ts
				doc:      doc
				error:    false
			}

			if !doc.deleted
				diff.loading = true
				url = "/project/#{@$scope.project_id}/doc/#{diff.doc.id}/diff"
				if diff.fromV? and diff.toV?
					url += "?from=#{diff.fromV}&to=#{diff.toV}"

				@ide.$http
					.get(url)
					.success (data) =>
						diff.loading = false
						{text, highlights} = @_parseDiff(data)
						diff.text = text
						diff.highlights = highlights
					.error () ->
						diff.loading = false
						diff.error = true
			else
				diff.deleted = true
				diff.restoreInProgress = false
				diff.restoreDeletedSuccess = false
				diff.restoredDocNewId = null

		restoreDeletedDoc: (doc) ->
			url = "/project/#{@$scope.project_id}/doc/#{doc.id}/restore"
			@ide.$http.post(url, name: doc.name, _csrf: window.csrfToken)

		restoreDiff: (diff) ->
			url = "/project/#{@$scope.project_id}/doc/#{diff.doc.id}/version/#{diff.fromV}/restore"
			@ide.$http.post(url, _csrf: window.csrfToken)

		_parseDiff: (diff) ->
			row    = 0
			column = 0
			highlights = []
			text   = ""
			for entry, i in diff.diff or []
				content = entry.u or entry.i or entry.d
				content ||= ""
				text += content
				lines   = content.split("\n")
				startRow    = row
				startColumn = column
				if lines.length > 1
					endRow    = startRow + lines.length - 1
					endColumn = lines[lines.length - 1].length
				else
					endRow    = startRow
					endColumn = startColumn + lines[0].length
				row    = endRow
				column = endColumn

				range = {
					start:
						row: startRow
						column: startColumn
					end:
						row: endRow
						column: endColumn
				}

				if entry.i? or entry.d?
					if entry.meta.user?
						name = "#{entry.meta.user.first_name} #{entry.meta.user.last_name}"
					else
						name = "Anonymous"
					if entry.meta.user?.id == @$scope.user.id
						name = "you"
					date = moment(entry.meta.end_ts).format("Do MMM YYYY, h:mm a")
					if entry.i?
						highlights.push {
							label: "Added by #{name} on #{date}"
							highlight: range
							hue: ColorManager.getHueForUserId(entry.meta.user?.id)
						}
					else if entry.d?
						highlights.push {
							label: "Deleted by #{name} on #{date}"
							strikeThrough: range
							hue: ColorManager.getHueForUserId(entry.meta.user?.id)
						}

			return {text, highlights}

		_loadUpdates: (updates = []) ->
			previousUpdate = @$scope.history.updates[@$scope.history.updates.length - 1]

			for update in updates
				for doc_id, doc of update.docs or {}
					doc.entity = @ide.fileTreeManager.findEntityById(doc_id, includeDeleted: true)

				for user in update.meta.users or []
					if user?
						user.hue = ColorManager.getHueForUserId(user.id)

				if !previousUpdate? or !moment(previousUpdate.meta.end_ts).isSame(update.meta.end_ts, "day")
					update.meta.first_in_day = true

				update.selectedFrom = false
				update.selectedTo = false
				update.inSelection = false

				previousUpdate = update

			firstLoad = @$scope.history.updates.length == 0

			@$scope.history.updates =
				@$scope.history.updates.concat(updates)

			@autoSelectRecentUpdates() if firstLoad

		_calculateRangeFromSelection: () ->
			fromV = toV = start_ts = end_ts = null

			selected_doc_id = @$scope.history.selection.doc?.id

			for update in @$scope.history.selection.updates or []
				for doc_id, doc of update.docs
					if doc_id == selected_doc_id
						if fromV? and toV?
							fromV = Math.min(fromV, doc.fromV)
							toV = Math.max(toV, doc.toV)
							start_ts = Math.min(start_ts, update.meta.start_ts)
							end_ts = Math.max(end_ts, update.meta.end_ts)
						else
							fromV = doc.fromV
							toV = doc.toV
							start_ts = update.meta.start_ts
							end_ts = update.meta.end_ts
						break

			return {fromV, toV, start_ts, end_ts}

		# Set the track changes selected doc to one of the docs in the range
		# of currently selected updates. If we already have a selected doc
		# then prefer this one if present.
		_selectDocFromUpdates: () ->
			affected_docs = {}
			for update in @$scope.history.selection.updates
				for doc_id, doc of update.docs
					affected_docs[doc_id] = doc.entity

			selected_doc = @$scope.history.selection.doc
			if selected_doc? and affected_docs[selected_doc.id]?
				# Selected doc is already open
			else
				for doc_id, doc of affected_docs
					selected_doc = doc
					break

			@$scope.history.selection.doc = selected_doc
			@ide.fileTreeManager.selectEntity(selected_doc)

		_updateContainsUserId: (update, user_id) ->
			for user in update.meta.users
				return true if user?.id == user_id
			return false
