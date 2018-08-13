define [
	"moment"
	"ide/colors/ColorManager"
	"ide/history/util/displayNameForUser"
	"ide/history/util/HistoryViewModes"
	"ide/history/controllers/HistoryV2ListController"
	"ide/history/controllers/HistoryV2DiffController"
	"ide/history/controllers/HistoryV2FileTreeController"
	"ide/history/controllers/HistoryV2ToolbarController"
	"ide/history/controllers/HistoryV2AddLabelModalController"
	"ide/history/controllers/HistoryV2DeleteLabelModalController"
	"ide/history/directives/infiniteScroll"
	"ide/history/components/historyEntriesList"
	"ide/history/components/historyEntry"
	"ide/history/components/historyLabelsList"
	"ide/history/components/historyLabel"
	"ide/history/components/historyFileTree"
	"ide/history/components/historyFileEntity"
], (moment, ColorManager, displayNameForUser, HistoryViewModes) ->
	class HistoryManager
		constructor: (@ide, @$scope) ->
			@reset()
			@$scope.HistoryViewModes = HistoryViewModes

			@$scope.toggleHistory = () =>
				if @$scope.ui.view == "history"
					@hide()
				else
					@show()
				@ide.$timeout () =>
					@$scope.$broadcast "history:toggle"
				, 0

			@$scope.toggleHistoryViewMode = () =>
				if @$scope.history.viewMode == HistoryViewModes.COMPARE
					@reset()
					@$scope.history.viewMode = HistoryViewModes.POINT_IN_TIME
				else
					@reset()
					@$scope.history.viewMode = HistoryViewModes.COMPARE
				@ide.$timeout () =>
					@$scope.$broadcast "history:toggle"
				, 0

			@$scope.$watch "history.selection.updates", (updates) =>
				if @$scope.history.viewMode == HistoryViewModes.COMPARE
					if updates? and updates.length > 0
						@_selectDocFromUpdates()
						@reloadDiff()
			
			@$scope.$watch "history.selection.pathname", (pathname) =>
				if @$scope.history.viewMode == HistoryViewModes.POINT_IN_TIME
					if pathname?
						@loadFileAtPointInTime()
				else 
					@reloadDiff()

			@$scope.$watch "history.showOnlyLabels", (showOnlyLabels, prevVal) =>
				if showOnlyLabels? and showOnlyLabels != prevVal 
					if showOnlyLabels
						@selectedLabelFromUpdatesSelection()
					else
						@$scope.history.selection.label = null
						if @$scope.history.selection.updates.length == 0
							@autoSelectLastUpdate()

			@$scope.$watch "history.updates.length", () =>
				@recalculateSelectedUpdates()

		show: () ->
			@$scope.ui.view = "history"
			@reset()
			@$scope.history.viewMode = HistoryViewModes.POINT_IN_TIME

		hide: () ->
			@$scope.ui.view = "editor"

		reset: () ->
			@$scope.history = {
				isV2: true
				updates: []
				viewMode: null
				nextBeforeTimestamp: null
				atEnd: false
				selection: {
					label: null
					updates: []
					docs: {}
					pathname: null
					range: {
						fromV: null
						toV: null
					}
				}
				showOnlyLabels: false
				labels: null
				files: []
				diff: null # When history.viewMode == HistoryViewModes.COMPARE
				selectedFile: null # When history.viewMode == HistoryViewModes.POINT_IN_TIME
			}

		restoreFile: (version, pathname) ->
			url = "/project/#{@$scope.project_id}/restore_file"

			@ide.$http.post(url, {
				version, pathname,
				_csrf: window.csrfToken
			})

		loadFileTreeForVersion: (version) ->
			url = "/project/#{@$scope.project_id}/filetree/diff"
			query = [ "from=#{version}", "to=#{version}" ]
			url += "?" + query.join("&")
			@$scope.history.loadingFileTree = true
			@$scope.history.selectedFile = null
			@$scope.history.selection.pathname = null
			@ide.$http
				.get(url)
				.then (response) =>
					@$scope.history.files = response.data.diff
					@$scope.history.loadingFileTree = false

		MAX_RECENT_UPDATES_TO_SELECT: 5
		autoSelectRecentUpdates: () ->
			return if @$scope.history.updates.length == 0

			@$scope.history.updates[0].selectedTo = true

			indexOfLastUpdateNotByMe = 0
			for update, i in @$scope.history.updates
				if @_updateContainsUserId(update, @$scope.user.id) or i > @MAX_RECENT_UPDATES_TO_SELECT
					break
				indexOfLastUpdateNotByMe = i

			@$scope.history.updates[indexOfLastUpdateNotByMe].selectedFrom = true

		autoSelectLastUpdate: () ->
			return if @$scope.history.updates.length == 0
			@selectUpdate @$scope.history.updates[0]

		autoSelectLastLabel: () ->
			return if @$scope.history.labels.length == 0
			@selectLabel @$scope.history.labels[0]
			
		selectUpdate: (update) ->
			selectedUpdateIndex = @$scope.history.updates.indexOf update
			if selectedUpdateIndex == -1
				selectedUpdateIndex = 0
			for update in @$scope.history.updates
				update.selectedTo = false
				update.selectedFrom = false
			@$scope.history.updates[selectedUpdateIndex].selectedTo = true
			@$scope.history.updates[selectedUpdateIndex].selectedFrom = true
			@recalculateSelectedUpdates()
			@loadFileTreeForVersion @$scope.history.updates[selectedUpdateIndex].toV

		selectedLabelFromUpdatesSelection: () ->
			# Get the number of labels associated with the currently selected update
			nSelectedLabels = @$scope.history.selection.updates?[0]?.labels?.length
			# If the currently selected update has no labels, select the last one (version-wise)
			if nSelectedLabels == 0
				@autoSelectLastLabel()
			# If the update has one label, select it 
			else if nSelectedLabels == 1
				@selectLabel @$scope.history.selection.updates[0].labels[0]
			# If there are multiple labels for the update, select the latest
			else if nSelectedLabels > 1
				sortedLabels = @ide.$filter("orderBy")(@$scope.history.selection.updates[0].labels, '-created_at')
				lastLabelFromUpdate = sortedLabels[0]
				@selectLabel lastLabelFromUpdate
				
		selectLabel: (labelToSelect) ->
			updateToSelect = null

			if @_isLabelSelected labelToSelect
				# Label already selected
				return

			for update in @$scope.history.updates
				if update.toV == labelToSelect.version
					updateToSelect = update
					break

			@$scope.history.selection.label = labelToSelect
			if updateToSelect?
				@selectUpdate updateToSelect
			else
				@$scope.history.selection.updates = []
				@loadFileTreeForVersion labelToSelect.version

		recalculateSelectedUpdates: () ->
			beforeSelection = true
			afterSelection = false
			@$scope.history.selection.updates = []
			for update in @$scope.history.updates
				if update.selectedTo
					inSelection = true
					beforeSelection = false

				update.beforeSelection = beforeSelection
				update.inSelection = inSelection
				update.afterSelection = afterSelection

				if inSelection
					@$scope.history.selection.updates.push update

				if update.selectedFrom
					inSelection = false
					afterSelection = true

		BATCH_SIZE: 10
		fetchNextBatchOfUpdates: () ->
			updatesURL = "/project/#{@ide.project_id}/updates?min_count=#{@BATCH_SIZE}"
			if @$scope.history.nextBeforeTimestamp?
				updatesURL += "&before=#{@$scope.history.nextBeforeTimestamp}"
			labelsURL = "/project/#{@ide.project_id}/labels"

			@$scope.history.loading = true
			@$scope.history.loadingFileTree = true
			
			requests = 
				updates: @ide.$http.get updatesURL
			
			if !@$scope.history.labels?
				requests.labels = @ide.$http.get labelsURL

			@ide.$q.all requests
				.then (response) =>
					updatesData = response.updates.data
					if response.labels?
						@$scope.history.labels = @_sortLabelsByVersionAndDate response.labels.data
					@_loadUpdates(updatesData.updates)
					@$scope.history.nextBeforeTimestamp = updatesData.nextBeforeTimestamp
					if !updatesData.nextBeforeTimestamp?
						@$scope.history.atEnd = true
					@$scope.history.loading = false

		_sortLabelsByVersionAndDate: (labels) ->
			@ide.$filter("orderBy")(labels, [ '-version', '-created_at' ])

		loadFileAtPointInTime: () ->
			pathname = @$scope.history.selection.pathname
			if @$scope.history.selection.updates?[0]?
				toV = @$scope.history.selection.updates[0].toV
			else if @$scope.history.selection.label?
				toV = @$scope.history.selection.label.version

			if !toV?
				return
			url = "/project/#{@$scope.project_id}/diff"
			query = ["pathname=#{encodeURIComponent(pathname)}", "from=#{toV}", "to=#{toV}"]
			url += "?" + query.join("&")
			@$scope.history.selectedFile =
				loading: true
			@ide.$http
				.get(url)
				.then (response) =>
					{text, binary} = @_parseDiff(response.data.diff)
					@$scope.history.selectedFile.binary = binary
					@$scope.history.selectedFile.text = text
					@$scope.history.selectedFile.loading = false
				.catch () ->

		reloadDiff: () ->
			diff = @$scope.history.diff
			{updates} = @$scope.history.selection
			{fromV, toV, pathname} = @_calculateDiffDataFromSelection()

			if !pathname?
				@$scope.history.diff = null
				return

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
					{text, highlights, binary} = @_parseDiff(data.diff)
					diff.binary = binary
					diff.text = text
					diff.highlights = highlights
				.catch () ->
					diff.loading = false
					diff.error = true

		labelCurrentVersion: (labelComment) => 
			@_labelVersion labelComment, @$scope.history.selection.updates[0].toV

		deleteLabel: (label) =>
			url = "/project/#{@$scope.project_id}/labels/#{label.id}"

			@ide.$http({
				url,
				method: "DELETE"
				headers:
					"X-CSRF-Token": window.csrfToken
			}).then (response) =>
				@_deleteLabelLocally label

		_isLabelSelected: (label) ->
			label.id == @$scope.history.selection.label?.id

		_deleteLabelLocally: (labelToDelete) ->
			for update, i in @$scope.history.updates
				if update.toV == labelToDelete.version
					update.labels = _.filter update.labels, (label) -> 
						label.id != labelToDelete.id
					break 
			@$scope.history.labels = _.filter @$scope.history.labels, (label) -> 
				label.id != labelToDelete.id

		_parseDiff: (diff) ->
			if diff.binary
				return { binary: true }
			row    = 0
			column = 0
			highlights = []
			text   = ""
			for entry, i in diff or []
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
					user = entry.meta.users?[0]
					name = displayNameForUser(user)
					date = moment(entry.meta.end_ts).format("Do MMM YYYY, h:mm a")
					if entry.i?
						highlights.push {
							label: "Added by #{name} on #{date}"
							highlight: range
							hue: ColorManager.getHueForUserId(user?.id)
						}
					else if entry.d?
						highlights.push {
							label: "Deleted by #{name} on #{date}"
							strikeThrough: range
							hue: ColorManager.getHueForUserId(user?.id)
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

			if firstLoad 
				if @$scope.history.viewMode == HistoryViewModes.COMPARE
					@autoSelectRecentUpdates()
				else 
					if @$scope.history.showOnlyLabels
						@autoSelectLastLabel()
					else
						@autoSelectLastUpdate()

		_labelVersion: (comment, version) ->
			url = "/project/#{@$scope.project_id}/labels"
			@ide.$http
				.post url, {
					comment,
					version,
					_csrf: window.csrfToken
				}
				.then (response) =>
					@_addLabelToLocalUpdate response.data

		_addLabelToLocalUpdate: (label) =>
			localUpdate = _.find @$scope.history.updates, (update) -> update.toV == label.version
			if localUpdate?
				localUpdate.labels = @_sortLabelsByVersionAndDate localUpdate.labels.concat label
			@$scope.history.labels = @_sortLabelsByVersionAndDate @$scope.history.labels.concat label

		_perDocSummaryOfUpdates: (updates) ->
			# Track current_pathname -> original_pathname
			# create bare object for use as Map
			# http://ryanmorr.com/true-hash-maps-in-javascript/
			original_pathnames = Object.create(null)

			# Map of original pathname -> doc summary
			docs_summary = Object.create(null)

			updatePathnameWithUpdateVersions = (pathname, update, deletedAtV) ->
				# docs_summary is indexed by the original pathname the doc
				# had at the start, so we have to look this up from the current
				# pathname via original_pathname first
				if !original_pathnames[pathname]?
						original_pathnames[pathname] = pathname
				original_pathname = original_pathnames[pathname]
				doc_summary = docs_summary[original_pathname] ?= {
					fromV: update.fromV, toV: update.toV,
				}
				doc_summary.fromV = Math.min(
					doc_summary.fromV,
					update.fromV
				)
				doc_summary.toV = Math.max(
					doc_summary.toV,
					update.toV
				)
				if deletedAtV?
					doc_summary.deletedAtV = deletedAtV

			# Put updates in ascending chronological order
			updates = updates.slice().reverse()
			for update in updates
				for pathname in update.pathnames or []
					updatePathnameWithUpdateVersions(pathname, update)
				for project_op in update.project_ops or []
					if project_op.rename?
						rename = project_op.rename
						updatePathnameWithUpdateVersions(rename.pathname, update)
						original_pathnames[rename.newPathname] = original_pathnames[rename.pathname]
						delete original_pathnames[rename.pathname]
					if project_op.add?
						add = project_op.add
						updatePathnameWithUpdateVersions(add.pathname, update)
					if project_op.remove?
						remove = project_op.remove
						updatePathnameWithUpdateVersions(remove.pathname, update, project_op.atV)

			return docs_summary

		_calculateDiffDataFromSelection: () ->
			fromV = toV = pathname = null

			selected_pathname = @$scope.history.selection.pathname

			for pathname, doc of @_perDocSummaryOfUpdates(@$scope.history.selection.updates)
				if pathname == selected_pathname
					{fromV, toV} = doc
					return {fromV, toV, pathname}

			return {}

		# Set the track changes selected doc to one of the docs in the range
		# of currently selected updates. If we already have a selected doc
		# then prefer this one if present.
		_selectDocFromUpdates: () ->
			affected_docs = @_perDocSummaryOfUpdates(@$scope.history.selection.updates)
			@$scope.history.selection.docs = affected_docs

			selected_pathname = @$scope.history.selection.pathname
			if selected_pathname? and affected_docs[selected_pathname]
				# Selected doc is already open
			else
				# Set to first possible candidate
				for pathname, doc of affected_docs
					selected_pathname = pathname
					break

			@$scope.history.selection.pathname = selected_pathname

		_updateContainsUserId: (update, user_id) ->
			for user in update.meta.users
				return true if user?.id == user_id
			return false
