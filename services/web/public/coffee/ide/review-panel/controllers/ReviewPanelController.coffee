define [
	"base",
	"utils/EventEmitter"
	"ide/colors/ColorManager"
	"ide/review-panel/RangesTracker"
], (App, EventEmitter, ColorManager, RangesTracker) ->
	App.controller "ReviewPanelController", ($scope, $element, ide, $timeout, $http, $modal, event_tracking, localStorage) ->
		$reviewPanelEl = $element.find "#review-panel"

		$scope.SubViews =
			CUR_FILE : "cur_file"
			OVERVIEW : "overview"

		$scope.UserTCSyncState = UserTCSyncState =
			SYNCED  : "synced"
			PENDING : "pending"


		window.reviewPanel = # DEBUG LINE
		$scope.reviewPanel =
			trackChangesState: {}
			trackChangesOnForEveryone: false
			entries: {}
			resolvedComments: {}
			hasEntries: false
			subView: $scope.SubViews.CUR_FILE
			openSubView: $scope.SubViews.CUR_FILE
			overview:
				loading: false
				docsCollapsedState: JSON.parse(localStorage("docs_collapsed_state:#{$scope.project_id}")) or {}
			dropdown:
				loading: false
			commentThreads: {}
			resolvedThreadIds: {}
			rendererData: {}
			formattedProjectMembers: {}
			fullTCStateCollapsed: true
			loadingThreads: false
			# All selected changes. If a aggregated change (insertion + deletion) is selection, the two ids
			# will be present. The length of this array will differ from the count below (see explanation).
			selectedEntryIds: [] 
			# A count of user-facing selected changes. An aggregated change (insertion + deletion) will count
			# as only one.
			nVisibleSelectedChanges: 0

		window.addEventListener "beforeunload", () ->
			collapsedStates = {}
			for doc, state of $scope.reviewPanel.overview.docsCollapsedState
				if state
					collapsedStates[doc] = state 
			valToStore = if Object.keys(collapsedStates).length > 0 then JSON.stringify(collapsedStates) else null
			localStorage("docs_collapsed_state:#{$scope.project_id}", valToStore)

		$scope.$on "layout:pdf:linked", (event, state) ->
			$scope.$broadcast "review-panel:layout"

		$scope.$on "layout:pdf:resize", (event, state) ->
			$scope.$broadcast "review-panel:layout", false

		$scope.$on "expandable-text-area:resize", (event) ->
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

		$scope.$on "review-panel:sizes", (e, sizes) ->
			$scope.$broadcast "editor:set-scroll-size", sizes
		
		$scope.$watch "project.features.trackChangesVisible", (visible) ->
			return if !visible?
			if !visible
				$scope.ui.reviewPanelOpen = false

		$scope.$watch "project.members", (members) ->
			$scope.reviewPanel.formattedProjectMembers = {}
			if $scope.project?.owner?
				$scope.reviewPanel.formattedProjectMembers[$scope.project.owner._id] = formatUser($scope.project.owner)
			if $scope.project?.members?
				for member in members
					if member.privileges == "readAndWrite"
						$scope.reviewPanel.formattedProjectMembers[member._id] = formatUser(member)

		$scope.commentState =
			adding: false
			content: ""

		$scope.users = {}

		$scope.reviewPanelEventsBridge = new EventEmitter()
		
		ide.socket.on "new-comment", (thread_id, comment) ->
			thread = getThread(thread_id)
			delete thread.submitting
			thread.messages.push(formatComment(comment))
			$scope.$apply()
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

		ide.socket.on "accept-changes", (doc_id, change_ids) ->
			if doc_id != $scope.editor.open_doc_id
				getChangeTracker(doc_id).removeChangeIds(change_ids)
			else
				$scope.$broadcast "changes:accept", change_ids
			updateEntries(doc_id)
			$scope.$apply () ->
		
		ide.socket.on "resolve-thread", (thread_id, user) ->
			_onCommentResolved(thread_id, user)
			
		ide.socket.on "reopen-thread", (thread_id) ->
			_onCommentReopened(thread_id)
		
		ide.socket.on "delete-thread", (thread_id) ->
			_onThreadDeleted(thread_id)
			$scope.$apply () ->
		
		ide.socket.on "edit-message", (thread_id, message_id, content) ->
			_onCommentEdited(thread_id, message_id, content)
			$scope.$apply () ->
		
		ide.socket.on "delete-message", (thread_id, message_id) ->
			_onCommentDeleted(thread_id, message_id)
			$scope.$apply () ->

		rangesTrackers = {}

		getDocEntries = (doc_id) ->
			$scope.reviewPanel.entries[doc_id] ?= {}
			return $scope.reviewPanel.entries[doc_id]

		getDocResolvedComments = (doc_id) ->
			$scope.reviewPanel.resolvedComments[doc_id] ?= {}
			return $scope.reviewPanel.resolvedComments[doc_id]
		
		getThread = (thread_id) ->
			$scope.reviewPanel.commentThreads[thread_id] ?= { messages: [] }
			return $scope.reviewPanel.commentThreads[thread_id]

		getChangeTracker = (doc_id) ->
			if !rangesTrackers[doc_id]?
				rangesTrackers[doc_id] = new RangesTracker()
				rangesTrackers[doc_id].resolvedThreadIds = $scope.reviewPanel.resolvedThreadIds
			return rangesTrackers[doc_id]

		scrollbar = {}
		$scope.reviewPanelEventsBridge.on "aceScrollbarVisibilityChanged", (isVisible, scrollbarWidth) ->
			scrollbar = {isVisible, scrollbarWidth}
			updateScrollbar()

		updateScrollbar = () ->
			if scrollbar.isVisible and $scope.reviewPanel.subView == $scope.SubViews.CUR_FILE
				$reviewPanelEl.css "right", "#{ scrollbar.scrollbarWidth }px"
			else
				$reviewPanelEl.css "right", "0"

		$scope.$watch "!ui.reviewPanelOpen && reviewPanel.hasEntries", (open, prevVal) ->
			return if !open?
			$scope.ui.miniReviewPanelVisible = open
			if open != prevVal
				$timeout () -> $scope.$broadcast "review-panel:toggle"

		$scope.$watch "ui.reviewPanelOpen", (open) ->
			return if !open?
			if !open
				# Always show current file when not open, but save current state
				$scope.reviewPanel.openSubView = $scope.reviewPanel.subView
				$scope.reviewPanel.subView = $scope.SubViews.CUR_FILE
			else
				# Reset back to what we had when previously open
				$scope.reviewPanel.subView = $scope.reviewPanel.openSubView
			$timeout () ->
				$scope.$broadcast "review-panel:toggle"
				$scope.$broadcast "review-panel:layout", false

		$scope.$watch "reviewPanel.subView", (view) ->
			return if !view?
			updateScrollbar()
			if view == $scope.SubViews.OVERVIEW
				refreshOverviewPanel()

		$scope.$watch "editor.sharejs_doc", (doc, old_doc) ->
			return if !doc?
			# The open doc range tracker is kept up to date in real-time so
			# replace any outdated info with this
			rangesTrackers[doc.doc_id] = doc.ranges
			rangesTrackers[doc.doc_id].resolvedThreadIds = $scope.reviewPanel.resolvedThreadIds
			$scope.reviewPanel.rangesTracker = rangesTrackers[doc.doc_id]
			if old_doc?
				old_doc.off "flipped_pending_to_inflight"
			doc.on "flipped_pending_to_inflight", () ->
				regenerateTrackChangesId(doc)
			regenerateTrackChangesId(doc)

		$scope.$watch (() ->
			entries = $scope.reviewPanel.entries[$scope.editor.open_doc_id] or {}
			permEntries = {}
			for entry, entryData of entries
				if entry not in [ "add-comment", "bulk-actions" ]
					permEntries[entry] = entryData 
			Object.keys(permEntries).length
		), (nEntries) ->
			$scope.reviewPanel.hasEntries = nEntries > 0 and $scope.project.features.trackChangesVisible

		regenerateTrackChangesId = (doc) ->
			old_id = getChangeTracker(doc.doc_id).getIdSeed()
			new_id = RangesTracker.generateIdSeed()
			getChangeTracker(doc.doc_id).setIdSeed(new_id)
			doc.setTrackChangesIdSeeds({pending: new_id, inflight: old_id})
		
		refreshRanges = () ->
			$http.get "/project/#{$scope.project_id}/ranges"
				.success (docs) ->
					for doc in docs
						if !$scope.reviewPanel.overview.docsCollapsedState[doc.id]?
							$scope.reviewPanel.overview.docsCollapsedState[doc.id] = false
						if doc.id != $scope.editor.open_doc_id # this is kept up to date in real-time, don't overwrite
							rangesTracker = getChangeTracker(doc.id)
							rangesTracker.comments = doc.ranges?.comments or []
							rangesTracker.changes = doc.ranges?.changes or []
						updateEntries(doc.id)

		refreshOverviewPanel = () ->
			$scope.reviewPanel.overview.loading = true
			refreshRanges()
				.then () ->
					$scope.reviewPanel.overview.loading = false
				.catch () ->
					$scope.reviewPanel.overview.loading = false

		$scope.refreshResolvedCommentsDropdown = () ->
			$scope.reviewPanel.dropdown.loading = true
			q = refreshRanges()
			q.then () ->
				$scope.reviewPanel.dropdown.loading = false
			q.catch () ->
				$scope.reviewPanel.dropdown.loading = false
			return q

		updateEntries = (doc_id) ->
			rangesTracker = getChangeTracker(doc_id)
			entries = getDocEntries(doc_id)
			resolvedComments = getDocResolvedComments(doc_id)
			
			changed = false

			# Assume we'll delete everything until we see it, then we'll remove it from this object
			delete_changes = {}
			for id, change of entries
				if id not in [ "add-comment", "bulk-actions" ]
					for entry_id in change.entry_ids
						delete_changes[entry_id] = true 
			for id, change of resolvedComments
				for entry_id in change.entry_ids
					delete_changes[entry_id] = true 

			potential_aggregate = false
			prev_insertion = null

			for change in rangesTracker.changes
				changed = true
				
				if (
					potential_aggregate and 
					change.op.d and 
					change.op.p == prev_insertion.op.p + prev_insertion.op.i.length and
					change.metadata.user_id == prev_insertion.metadata.user_id
				)
					# An actual aggregate op.
					entries[prev_insertion.id].type = "aggregate-change"
					entries[prev_insertion.id].metadata.replaced_content = change.op.d
					entries[prev_insertion.id].entry_ids.push change.id
				else
					entries[change.id] ?= {}
					delete delete_changes[change.id]
					new_entry = {
						type: if change.op.i then "insert" else "delete"
						entry_ids: [ change.id ]
						content: change.op.i or change.op.d
						offset: change.op.p
						metadata: change.metadata
					}
					for key, value of new_entry
						entries[change.id][key] = value

				if change.op.i
					potential_aggregate = true
					prev_insertion = change
				else
					potential_aggregate = false
					prev_insertion = null

				if !$scope.users[change.metadata.user_id]?
					refreshChangeUsers(change.metadata.user_id)

			if rangesTracker.comments.length > 0
				ensureThreadsAreLoaded()

			for comment in rangesTracker.comments
				changed = true
				delete delete_changes[comment.id]
				if $scope.reviewPanel.resolvedThreadIds[comment.op.t]
					new_comment = resolvedComments[comment.id] ?= {}
					delete entries[comment.id]
				else
					new_comment = entries[comment.id] ?= {}
					delete resolvedComments[comment.id]
				new_entry = {
					type: "comment"
					thread_id: comment.op.t
					entry_ids: [ comment.id ]
					content: comment.op.c
					offset: comment.op.p
				}
				for key, value of new_entry
					new_comment[key] = value

			for change_id, _ of delete_changes
				changed = true
				delete entries[change_id]
				delete resolvedComments[change_id]
			
			if changed
				$scope.$broadcast "entries:changed"

		$scope.$on "editor:track-changes:changed", () ->
			doc_id = $scope.editor.open_doc_id
			updateEntries(doc_id)
			$scope.$broadcast "review-panel:recalculate-screen-positions"
			$scope.$broadcast "review-panel:layout"

		$scope.$on "editor:track-changes:visibility_changed", () ->
			$timeout () ->
				$scope.$broadcast "review-panel:layout", false

		$scope.$on "editor:focus:changed", (e, selection_offset_start, selection_offset_end, selection) ->
			doc_id = $scope.editor.open_doc_id
			entries = getDocEntries(doc_id)
			# All selected changes will be added to this array.
			$scope.reviewPanel.selectedEntryIds = []
			# Count of user-visible changes, i.e. an aggregated change will count as one.
			$scope.reviewPanel.nVisibleSelectedChanges = 0
			delete entries["add-comment"]
			delete entries["bulk-actions"]

			if selection
				entries["add-comment"] = {
					type: "add-comment"
					offset: selection_offset_start
					length: selection_offset_end - selection_offset_start
				}
				entries["bulk-actions"] = {
					type: "bulk-actions"
					offset: selection_offset_start
					length: selection_offset_end - selection_offset_start
				}
			
			for id, entry of entries
				isChangeEntryAndWithinSelection = false
				if entry.type == "comment" and not $scope.reviewPanel.resolvedThreadIds[entry.thread_id]
					entry.focused = (entry.offset <= selection_offset_start <= entry.offset + entry.content.length)
				else if entry.type == "insert"
					isChangeEntryAndWithinSelection = entry.offset >= selection_offset_start and entry.offset + entry.content.length <= selection_offset_end
					entry.focused = (entry.offset <= selection_offset_start <= entry.offset + entry.content.length)
				else if entry.type == "delete"
					isChangeEntryAndWithinSelection = selection_offset_start <= entry.offset <= selection_offset_end
					entry.focused = (entry.offset == selection_offset_start)
				else if entry.type == "aggregate-change"
					isChangeEntryAndWithinSelection = entry.offset >= selection_offset_start and entry.offset + entry.content.length <= selection_offset_end
					entry.focused = (entry.offset <= selection_offset_start <= entry.offset + entry.content.length)
				else if entry.type in [ "add-comment", "bulk-actions" ] and selection
					entry.focused = true

				if isChangeEntryAndWithinSelection
					for entry_id in entry.entry_ids
						$scope.reviewPanel.selectedEntryIds.push entry_id
					$scope.reviewPanel.nVisibleSelectedChanges++
			
			$scope.$broadcast "review-panel:recalculate-screen-positions"
			$scope.$broadcast "review-panel:layout"

		$scope.acceptChanges = (change_ids) ->
			_doAcceptChanges change_ids
			event_tracking.sendMB "rp-changes-accepted", { view: if $scope.ui.reviewPanelOpen then $scope.reviewPanel.subView else 'mini' }

		$scope.rejectChanges = (change_ids) ->
			_doRejectChanges change_ids
			event_tracking.sendMB "rp-changes-rejected", { view: if $scope.ui.reviewPanelOpen then $scope.reviewPanel.subView else 'mini' }

		_doAcceptChanges = (change_ids) ->
			$http.post "/project/#{$scope.project_id}/doc/#{$scope.editor.open_doc_id}/changes/accept", { change_ids, _csrf: window.csrfToken}
			$scope.$broadcast "changes:accept", change_ids

		_doRejectChanges = (change_ids) ->
			$scope.$broadcast "changes:reject", change_ids

		bulkAccept = () ->
			_doAcceptChanges $scope.reviewPanel.selectedEntryIds.slice()
			event_tracking.sendMB "rp-bulk-accept", { 
				view: if $scope.ui.reviewPanelOpen then $scope.reviewPanel.subView else 'mini',  
				nEntries: $scope.reviewPanel.nVisibleSelectedChanges
			}

		bulkReject = () ->
			_doRejectChanges $scope.reviewPanel.selectedEntryIds.slice()
			event_tracking.sendMB "rp-bulk-reject", { 
				view: if $scope.ui.reviewPanelOpen then $scope.reviewPanel.subView else 'mini',  
				nEntries: $scope.reviewPanel.nVisibleSelectedChanges
			}

		$scope.showBulkAcceptDialog = () ->
			showBulkActionsDialog true

		$scope.showBulkRejectDialog = () -> 
			showBulkActionsDialog false

		showBulkActionsDialog = (isAccept) ->
			$modal.open({
				templateUrl: "bulkActionsModalTemplate"
				controller: "BulkActionsModalController"
				resolve:
					isAccept: () -> isAccept
					nChanges: () -> $scope.reviewPanel.nVisibleSelectedChanges
				scope: $scope.$new()
			}).result.then (isAccept) ->
				if isAccept
					bulkAccept()
				else
					bulkReject()

		$scope.handleTogglerClick = (e) ->
			e.target.blur()
			$scope.toggleReviewPanel()

		$scope.addNewComment = () ->
			$scope.$broadcast "comment:start_adding"
			$scope.toggleReviewPanel()

		$scope.addNewCommentFromKbdShortcut = () ->
			$scope.$broadcast "comment:select_line"
			if !$scope.ui.reviewPanelOpen
				$scope.toggleReviewPanel()
			$timeout () ->
				$scope.$broadcast "review-panel:layout"	
				$scope.$broadcast "comment:start_adding"

		$scope.startNewComment = () ->
			$scope.$broadcast "comment:select_line"
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

		$scope.submitNewComment = (content) ->
			return if !content? or content == ""
			doc_id = $scope.editor.open_doc_id
			entries = getDocEntries(doc_id)
			return if !entries["add-comment"]?
			{offset, length} = entries["add-comment"]
			thread_id = RangesTracker.generateId()
			thread = getThread(thread_id)
			thread.submitting = true
			$scope.$broadcast "comment:add", thread_id, offset, length
			$http.post("/project/#{$scope.project_id}/thread/#{thread_id}/messages", {content, _csrf: window.csrfToken})
				.error (error) ->
					ide.showGenericMessageModal("Error submitting comment", "Sorry, there was a problem submitting your comment")
			$scope.$broadcast "editor:clearSelection"
			$timeout () ->
				$scope.$broadcast "review-panel:layout"
			event_tracking.sendMB "rp-new-comment", { size: content.length }

		$scope.cancelNewComment = (entry) ->
			$timeout () ->
				$scope.$broadcast "review-panel:layout"
		
		$scope.startReply = (entry) ->
			entry.replying = true
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

		$scope.submitReply = (entry, entry_id) ->			
			thread_id = entry.thread_id
			content   = entry.replyContent
			$http.post("/project/#{$scope.project_id}/thread/#{thread_id}/messages", {content, _csrf: window.csrfToken})
				.error (error) ->
					ide.showGenericMessageModal("Error submitting comment", "Sorry, there was a problem submitting your comment")
			
			trackingMetadata =
				view: if $scope.ui.reviewPanelOpen then $scope.reviewPanel.subView else 'mini'
				size: entry.replyContent.length
				thread: thread_id

			thread = getThread(thread_id)
			thread.submitting = true
			entry.replyContent = ""
			entry.replying = false
			$timeout () ->
				$scope.$broadcast "review-panel:layout"
			event_tracking.sendMB "rp-comment-reply", trackingMetadata

		$scope.cancelReply = (entry) ->
			entry.replying = false
			entry.replyContent = ""
			$scope.$broadcast "review-panel:layout"

		$scope.resolveComment = (entry, entry_id) ->
			entry.focused = false
			$http.post "/project/#{$scope.project_id}/thread/#{entry.thread_id}/resolve", {_csrf: window.csrfToken}
			_onCommentResolved(entry.thread_id, ide.$scope.user)
			event_tracking.sendMB "rp-comment-resolve", { view: if $scope.ui.reviewPanelOpen then $scope.reviewPanel.subView else 'mini' }

		$scope.unresolveComment = (thread_id) ->
			_onCommentReopened(thread_id)
			$http.post "/project/#{$scope.project_id}/thread/#{thread_id}/reopen", {_csrf: window.csrfToken}
			event_tracking.sendMB "rp-comment-reopen"
		
		_onCommentResolved = (thread_id, user) ->
			thread = getThread(thread_id)
			return if !thread?
			thread.resolved = true
			thread.resolved_by_user = formatUser(user)
			thread.resolved_at = new Date().toISOString()
			$scope.reviewPanel.resolvedThreadIds[thread_id] = true
			$scope.$broadcast "comment:resolve_threads", [thread_id]
		
		_onCommentReopened = (thread_id) ->
			thread = getThread(thread_id)
			return if !thread?
			delete thread.resolved
			delete thread.resolved_by_user
			delete thread.resolved_at
			delete $scope.reviewPanel.resolvedThreadIds[thread_id]
			$scope.$broadcast "comment:unresolve_thread", thread_id

		_onThreadDeleted = (thread_id) ->
			delete $scope.reviewPanel.resolvedThreadIds[thread_id]
			delete $scope.reviewPanel.commentThreads[thread_id]
			$scope.$broadcast "comment:remove", thread_id
		
		_onCommentEdited = (thread_id, comment_id, content) ->
			thread = getThread(thread_id)
			return if !thread?
			for message in thread.messages
				if message.id == comment_id
					message.content = content
			updateEntries()
		
		_onCommentDeleted = (thread_id, comment_id) ->
			thread = getThread(thread_id)
			return if !thread?
			thread.messages = thread.messages.filter (m) -> m.id != comment_id
			updateEntries()
		
		$scope.deleteThread = (entry_id, doc_id, thread_id) ->
			_onThreadDeleted(thread_id)
			$http({
				method: "DELETE"
				url: "/project/#{$scope.project_id}/doc/#{doc_id}/thread/#{thread_id}",
				headers: {
					'X-CSRF-Token': window.csrfToken
				}
			})
			event_tracking.sendMB "rp-comment-delete"
		
		$scope.saveEdit = (thread_id, comment) ->
			$http.post("/project/#{$scope.project_id}/thread/#{thread_id}/messages/#{comment.id}/edit", {
				content: comment.content
				_csrf: window.csrfToken
			})
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

		$scope.deleteComment = (thread_id, comment) ->
			_onCommentDeleted(thread_id, comment.id)
			$http({
				method: "DELETE"
				url: "/project/#{$scope.project_id}/thread/#{thread_id}/messages/#{comment.id}",
				headers: {
					'X-CSRF-Token': window.csrfToken
				}
			})
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

		$scope.setSubView = (subView) -> 
			$scope.reviewPanel.subView = subView
			event_tracking.sendMB "rp-subview-change", { subView }
						
		$scope.gotoEntry = (doc_id, entry) ->
			ide.editorManager.openDocId(doc_id, { gotoOffset: entry.offset })

		$scope.toggleFullTCStateCollapse = () ->
			if $scope.project.features.trackChanges
				reviewPanel.fullTCStateCollapsed = !reviewPanel.fullTCStateCollapsed
			else
				$scope.openTrackChangesUpgradeModal()

		_setUserTCState = (userId, newValue, isLocal = false) ->
			$scope.reviewPanel.trackChangesState[userId] ?= {}
			state = $scope.reviewPanel.trackChangesState[userId]

			if !state.syncState? or state.syncState == UserTCSyncState.SYNCED
				state.value = newValue
				state.syncState = UserTCSyncState.SYNCED
			else if state.syncState == UserTCSyncState.PENDING and state.value == newValue
				state.syncState = UserTCSyncState.SYNCED
			else if isLocal
				state.value = newValue
				state.syncState = UserTCSyncState.PENDING
			
			if userId == ide.$scope.user.id
				$scope.editor.wantTrackChanges = newValue		

		_setEveryoneTCState = (newValue, isLocal = false) ->
			$scope.reviewPanel.trackChangesOnForEveryone = newValue
			for userId, userState of $scope.reviewPanel.trackChangesState
				userState.value = newValue
				userState.syncState = if isLocal then UserTCSyncState.PENDING else UserTCSyncState.SYNCED
			$scope.editor.wantTrackChanges = newValue

		applyClientTrackChangesStateToServer = () ->
			if $scope.reviewPanel.trackChangesOnForEveryone
				data = {on : true}
			else
				data = {on_for: {}}
				for userId, userState of $scope.reviewPanel.trackChangesState
					data.on_for[userId] = userState.value
			data._csrf = window.csrfToken
			$http.post "/project/#{$scope.project_id}/track_changes", data

		applyTrackChangesStateToClient = (state) ->
			if typeof state is "boolean"
				_setEveryoneTCState state
			else
				$scope.reviewPanel.trackChangesOnForEveryone = false
				for member in $scope.project.members
					_setUserTCState(member._id, state[member._id] ? false)
				_setUserTCState($scope.project.owner._id, state[$scope.project.owner._id] ? false)
		
		$scope.toggleTrackChangesForEveryone = (onForEveryone) ->
			_setEveryoneTCState onForEveryone, true
			applyClientTrackChangesStateToServer()
	
		window.toggleTrackChangesForUser = # DEBUG LINE
		$scope.toggleTrackChangesForUser = (onForUser, userId) ->
			_setUserTCState userId, onForUser, true
			applyClientTrackChangesStateToServer()				

		ide.socket.on "toggle-track-changes", (state) ->
			$scope.$apply () ->
				applyTrackChangesStateToClient(state)

		# Not sure what the kbd shortcut should do now?
		# $scope.toggleTrackChangesFromKbdShortcut = () ->
		# 	if $scope.editor.wantTrackChanges
		# 		$scope.toggleTrackChanges false
		# 	else 
		# 		$scope.toggleTrackChanges true

		_inited = false
		ide.$scope.$on "project:joined", () ->
			return if _inited
			project = ide.$scope.project
			if project.features.trackChanges
				window.trackChangesState ?= false
				applyTrackChangesStateToClient(window.trackChangesState)
			else
				applyTrackChangesStateToClient(false)
			_inited = true

		_refreshingRangeUsers = false
		_refreshedForUserIds = {}
		refreshChangeUsers = (refresh_for_user_id) ->
			if refresh_for_user_id?
				if _refreshedForUserIds[refresh_for_user_id]?
					# We've already tried to refresh to get this user id, so stop it looping
					return
				_refreshedForUserIds[refresh_for_user_id] = true

			# Only do one refresh at once
			if _refreshingRangeUsers
				return
			_refreshingRangeUsers = true

			$http.get "/project/#{$scope.project_id}/changes/users"
				.success (users) ->
					_refreshingRangeUsers = false
					$scope.users = {}
					# Always include ourself, since if we submit an op, we might need to display info
					# about it locally before it has been flushed through the server
					if ide.$scope.user?.id?
						$scope.users[ide.$scope.user.id] = formatUser(ide.$scope.user)
					for user in users
						if user.id?
							$scope.users[user.id] = formatUser(user)
				.error () ->
					_refreshingRangeUsers = false

		_threadsLoaded = false
		ensureThreadsAreLoaded = () ->
			if _threadsLoaded
				# We get any updates in real time so only need to load them once.
				return
			_threadsLoaded = true
			$scope.reviewPanel.loadingThreads = true
			$http.get "/project/#{$scope.project_id}/threads"
				.success (threads) ->
					$scope.reviewPanel.loadingThreads = false
					for thread_id, _ of $scope.reviewPanel.resolvedThreadIds
						delete $scope.reviewPanel.resolvedThreadIds[thread_id]
					for thread_id, thread of threads
						for comment in thread.messages
							formatComment(comment)
						if thread.resolved_by_user?
							thread.resolved_by_user = formatUser(thread.resolved_by_user)
							$scope.reviewPanel.resolvedThreadIds[thread_id] = true
							$scope.$broadcast "comment:resolve_threads", [thread_id]
					$scope.reviewPanel.commentThreads = threads
					$timeout () ->
						$scope.$broadcast "review-panel:layout"

		formatComment = (comment) ->
			comment.user = formatUser(comment.user)
			comment.timestamp = new Date(comment.timestamp)
			return comment

		formatUser = (user) ->
			id = user?._id or user?.id

			if !id?
				return {
					email: null
					name: "Anonymous"
					isSelf: false
					hue: ColorManager.ANONYMOUS_HUE
					avatar_text: "A"
				}
			if id == window.user_id
				name = "You"
				isSelf = true
			else
				name = [user.first_name, user.last_name].filter((n) -> n? and n != "").join(" ")
				if name == ""
					name = user.email?.split("@")[0] or "Unknown"
				isSelf = false
			return {
				id: id
				email: user.email
				name: name
				isSelf: isSelf
				hue: ColorManager.getHueForUserId(id)
				avatar_text: [user.first_name, user.last_name].filter((n) -> n?).map((n) -> n[0]).join ""
			}

		$scope.openTrackChangesUpgradeModal = () ->
			$modal.open {
				templateUrl: "trackChangesUpgradeModalTemplate"
				controller: "TrackChangesUpgradeModalController"
				scope: $scope.$new()
			}
