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
					# TODO: Set selection.pathname to entity path name
					# @$scope.history.selection.doc = entity
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
				.then (response) =>
					{ data } = response
					console.log "fetchNextBatchOfUpdates", data.updates
					@_loadUpdates(data.updates)
					@$scope.history.nextBeforeTimestamp = data.nextBeforeTimestamp
					if !data.nextBeforeTimestamp?
						@$scope.history.atEnd = true
					@$scope.history.loading = false

		reloadDiff: () ->
			diff = @$scope.history.diff
			{updates} = @$scope.history.selection
			{fromV, toV, pathname} = @_calculateDiffDataFromSelection()
			console.log "[reloadDiff] current diff", diff
			console.log "[reloadDiff] new diff data", {fromV, toV, pathname}

			return if !pathname?

			return if diff? and
				diff.pathname == pathname and
				diff.fromV    == fromV and
				diff.toV      == toV

			@$scope.history.diff = diff = {
				fromV:    fromV
				toV:      toV
				pathname: pathname
				error:    false
			}

			# TODO: How do we track deleted files now? We can probably show the diffs easily
			# with the new system!
			if true # !doc.deleted
				diff.loading = true
				url = "/project/#{@$scope.project_id}/diff"
				query = ["pathname=#{encodeURIComponent(pathname)}"]
				if diff.fromV? and diff.toV?
					query.push "from=#{diff.fromV}", "to=#{diff.toV}"
				url += "?" + query.join("&")

				@ide.$http
					.get(url)
					.then (response) =>
						{ data } = response
						diff.loading = false
						{text, highlights} = @_parseDiff(data)
						diff.text = text
						diff.highlights = highlights
					.catch () ->
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

			for update in updates or []
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

		_perDocSummaryOfUpdates: (updates) ->
			# Track current_pathname -> original_pathname
			original_pathnames = {}
			docs_summary = {}

			# Put updates in ascending chronological order
			updates = updates.slice().reverse()
			for update in updates
				for pathname in update.docs or []
					if !original_pathnames[pathname]?
						original_pathnames[pathname] = pathname
					original_pathname = original_pathnames[pathname]
					if !docs_summary[original_pathname]?
						docs_summary[original_pathname] = {
							fromV: update.fromV, toV: update.toV,
						}
					else
						docs_summary[original_pathname] = {
							fromV: Math.min(docs_summary[original_pathname].fromV, update.fromV),
							toV: Math.max(docs_summary[original_pathname].toV, update.toV),
						}
				for project_op in update.project_ops or []
					if project_op.rename?
						rename = project_op.rename
						if !original_pathnames[rename.pathname]?
							original_pathnames[rename.pathname] = rename.pathname
						original_pathnames[rename.newPathname] = original_pathnames[rename.pathname]
						delete original_pathnames[rename.pathname]

			return docs_summary

		_calculateDiffDataFromSelection: () ->
			fromV = toV = pathname = null

			selected_pathname = @$scope.history.selection.pathname

			for pathname, doc of @_perDocSummaryOfUpdates(@$scope.history.selection.updates)
				if pathname == selected_pathname
					{fromV, toV} = doc
					break

			return {fromV, toV, pathname}

		# Set the track changes selected doc to one of the docs in the range
		# of currently selected updates. If we already have a selected doc
		# then prefer this one if present.
		_selectDocFromUpdates: () ->
			affected_docs = @_perDocSummaryOfUpdates(@$scope.history.selection.updates)

			selected_pathname = @$scope.history.selection.pathname
			if selected_pathname? and affected_docs[selected_pathname]
				# Selected doc is already open
			else
				# Set to first possible candidate
				for pathname, doc of affected_docs
					selected_pathname = pathname
					break

			@$scope.history.selection.pathname = selected_pathname
			if selected_pathname?
				entity = @ide.fileTreeManager.findEntityByPath(selected_pathname)
				if entity?
					@ide.fileTreeManager.selectEntity(entity)

		_updateContainsUserId: (update, user_id) ->
			for user in update.meta.users
				return true if user?.id == user_id
			return false
