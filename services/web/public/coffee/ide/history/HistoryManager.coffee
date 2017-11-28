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
					# TODO: Set selection.doc_path to entity path name
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
				.then (response) =>
					{ data } = response
					@_loadUpdates(data.updates)
					@$scope.history.nextBeforeTimestamp = data.nextBeforeTimestamp
					if !data.nextBeforeTimestamp?
						@$scope.history.atEnd = true
					@$scope.history.loading = false

		reloadDiff: () ->
			diff = @$scope.history.diff
			{updates} = @$scope.history.selection
			{fromV, toV, start_ts, end_ts, original_path} = @_calculateDiffDataFromSelection()
			console.log "[reloadDiff] current diff", diff
			console.log "[reloadDiff] new diff data", {fromV, toV, start_ts, end_ts, original_path}

			return if !original_path?

			return if diff? and
				diff.doc_path == original_path and
				diff.fromV    == fromV and
				diff.toV      == toV

			@$scope.history.diff = diff = {
				fromV:    fromV
				toV:      toV
				start_ts: start_ts
				end_ts:   end_ts
				doc_path: original_path
				error:    false
			}

			# TODO: How do we track deleted files now? We can probably show the diffs easily
			# with the new system!
			if true # !doc.deleted
				diff.loading = true
				url = "/project/#{@$scope.project_id}/doc/by_path/diff"
				query = ["path=#{encodeURIComponent(original_path)}"]
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

			for update in updates
				for doc_path, doc of update.docs or {}
					doc.path = doc_path
					doc.entity = @ide.fileTreeManager.findEntityByPath(doc_path, includeDeleted: true)

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
			console.log "[_loadUpdates] updates", @$scope.history.updates

			@autoSelectRecentUpdates() if firstLoad

		_perDocSummaryOfUpdates: (updates) ->
			current_paths = {}
			docs_summary = {}

			for update in updates # Updates are reverse chronologically ordered
				console.log "[_perDocSummaryOfUpdates] update", update
				if update.docs?
					for doc_path, doc of update.docs
						# doc_path may not be the latest doc path that this doc has had
						if !current_paths[doc_path]?
							current_paths[doc_path] = doc_path
						current_path = current_paths[doc_path]
						console.log "[_perDocSummaryOfUpdates] doc", doc, current_path
						if !docs_summary[current_path]?
							# todo start_ts and end_ts
							docs_summary[current_path] = {
								fromV: doc.fromV, toV: doc.toV,
								original_path: doc_path
							}
						else
							docs_summary[current_path] = {
								fromV: Math.min(docs_summary[current_path].fromV, doc.fromV),
								toV: Math.max(docs_summary[current_path].toV, doc.toV),
								original_path: doc_path
							}
				else if update.renames?
					for rename in update.renames
						console.log "[_perDocSummaryOfUpdates] rename", rename
						if !current_paths[rename.newPathname]?
							current_paths[rename.newPathname] = rename.newPathname
						current_paths[rename.pathname] = current_paths[rename.newPathname]
						delete current_paths[rename.newPathname]

				console.log "[_perDocSummaryOfUpdates] docs_summary", docs_summary
				console.log "[_perDocSummaryOfUpdates] current_paths", current_paths

			return docs_summary

		_calculateDiffDataFromSelection: () ->
			fromV = toV = start_ts = end_ts = original_path = null

			selected_doc_path = @$scope.history.selection.doc_path
			console.log "[_calculateDiffDataFromSelection] selected_doc_path", selected_doc_path

			for doc_path, doc of @_perDocSummaryOfUpdates(@$scope.history.selection.updates)
				if doc_path == selected_doc_path
					fromV = doc.fromV
					toV = doc.toV
					start_ts = doc.start_ts
					end_ts = doc.end_ts
					original_path = doc.original_path
					break

			return {fromV, toV, start_ts, end_ts, original_path}

		# Set the track changes selected doc to one of the docs in the range
		# of currently selected updates. If we already have a selected doc
		# then prefer this one if present.
		_selectDocFromUpdates: () ->
			affected_docs = @_perDocSummaryOfUpdates(@$scope.history.selection.updates)
			console.log "[_selectDocFromUpdates] affected_docs", affected_docs

			selected_doc_path = @$scope.history.selection.doc_path
			console.log "[_selectDocFromUpdates] current selected_doc_path", selected_doc_path
			if selected_doc_path? and affected_docs[selected_doc_path]
				# Selected doc is already open
			else
				# Set to first possible candidate
				for doc_path, doc of affected_docs
					selected_doc_path = doc_path
					break

			console.log "[_selectDocFromUpdates] new selected_doc_path", selected_doc_path

			@$scope.history.selection.doc_path = selected_doc_path
			if selected_doc_path?
				entity = @ide.fileTreeManager.findEntityByPath(selected_doc_path)
				if entity?
					@ide.fileTreeManager.selectEntity(entity)

		_updateContainsUserId: (update, user_id) ->
			for user in update.meta.users
				return true if user?.id == user_id
			return false
