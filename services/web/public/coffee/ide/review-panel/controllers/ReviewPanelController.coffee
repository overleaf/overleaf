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

		$scope.reviewPanel =
			entries: {}
			resolvedComments: {}
			hasEntries: false
			subView: $scope.SubViews.CUR_FILE
			openSubView: $scope.SubViews.CUR_FILE
			overview:
				loading: false
				docsCollapsedState: {}
			dropdown:
				loading: false
			commentThreads: {}
			resolvedThreadIds: {}
			layoutToLeft: false
			rendererData: {}
			loadingThreads: false

		$scope.$on "project:joined", () ->
			$scope.reviewPanel.overview.docsCollapsedState = JSON.parse(localStorage("docs_collapsed_state:#{$scope.project_id}")) or {}

		window.addEventListener "beforeunload", () ->
			collapsedStates = {}
			for doc, state of $scope.reviewPanel.overview.docsCollapsedState
				collapsedStates[doc] = state if state is true
			valToStore = if Object.keys(collapsedStates).length > 0 then JSON.stringify(collapsedStates) else null
			localStorage("docs_collapsed_state:#{$scope.project_id}", valToStore)

		$scope.$on "layout:pdf:linked", (event, state) ->
			$scope.reviewPanel.layoutToLeft = (state.east?.size < 220 || state.east?.initClosed)
			$scope.$broadcast "review-panel:layout"

		$scope.$on "layout:pdf:resize", (event, state) ->
			$scope.reviewPanel.layoutToLeft = (state.east?.size < 220 || state.east?.initClosed)
			$scope.$broadcast "review-panel:layout", false

		$scope.$on "expandable-text-area:resize", (event) ->
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

		$scope.$on "review-panel:sizes", (e, sizes) ->
			$scope.$broadcast "editor:set-scroll-size", sizes

		$scope.$watch "ui.pdfLayout", (layout) ->
			$scope.reviewPanel.layoutToLeft = (layout == "flat")
		
		$scope.$watch "project.features.trackChangesVisible", (visible) ->
			return if !visible?
			if !visible
				$scope.ui.reviewPanelOpen = false

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
		
		ide.socket.on "accept-change", (doc_id, change_id) ->
			if doc_id != $scope.editor.open_doc_id
				getChangeTracker(doc_id).removeChangeId(change_id)
			else
				$scope.$broadcast "change:accept", change_id
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

		$scope.$watch "ui.reviewPanelOpen", (open) ->
			return if !open?
			if !open
				# Always show current file when not open, but save current state
				$scope.reviewPanel.openSubView = $scope.reviewPanel.subView
				$scope.reviewPanel.subView = $scope.SubViews.CUR_FILE
			else
				# Reset back to what we had when previously open
				$scope.reviewPanel.subView = $scope.reviewPanel.openSubView
		
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
			Object.keys(entries).length
		), (nEntries) ->
			$scope.reviewPanel.hasEntries = nEntries > 0 and $scope.project.features.trackChangesVisible

		$scope.$watch "ui.reviewPanelOpen", (reviewPanelOpen) ->
			return if !reviewPanelOpen?
			$timeout () ->
				$scope.$broadcast "review-panel:toggle"
				$scope.$broadcast "review-panel:layout", false

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
			for change_id, change of entries
				if change_id != "add-comment"
					delete_changes[change_id] = true 
			for change_id, change of resolvedComments
				delete_changes[change_id] = true 

			for change in rangesTracker.changes
				changed = true
				delete delete_changes[change.id]
				entries[change.id] ?= {}
					
				# Update in place to avoid a full DOM redraw via angular
				metadata = {}
				metadata[key] = value for key, value of change.metadata
				new_entry = {
					type: if change.op.i then "insert" else "delete"
					content: change.op.i or change.op.d
					offset: change.op.p
					metadata: change.metadata
				}
				for key, value of new_entry
					entries[change.id][key] = value

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

			delete entries["add-comment"]
			if selection
				# Only show add comment if we're not already overlapping one
				overlapping_comment = false
				for id, entry of entries
					if entry.type == "comment" and not $scope.reviewPanel.resolvedThreadIds[entry.thread_id]
						unless entry.offset >= selection_offset_end or entry.offset + entry.content.length <= selection_offset_start
							overlapping_comment = true
				if !overlapping_comment
					entries["add-comment"] = {
						type: "add-comment"
						offset: selection_offset_start
						length: selection_offset_end - selection_offset_start
					}
			
			for id, entry of entries
				if entry.type == "comment" and not $scope.reviewPanel.resolvedThreadIds[entry.thread_id]
					entry.focused = (entry.offset <= selection_offset_start <= entry.offset + entry.content.length)
				else if entry.type == "insert"
					entry.focused = (entry.offset <= selection_offset_start <= entry.offset + entry.content.length)
				else if entry.type == "delete"
					entry.focused = (entry.offset == selection_offset_start)
				else if entry.type == "add-comment" and selection
					entry.focused = true
			
			$scope.$broadcast "review-panel:recalculate-screen-positions"
			$scope.$broadcast "review-panel:layout"

		$scope.acceptChange = (entry_id) ->
			$http.post "/project/#{$scope.project_id}/doc/#{$scope.editor.open_doc_id}/changes/#{entry_id}/accept", {_csrf: window.csrfToken}
			$scope.$broadcast "change:accept", entry_id
			event_tracking.sendMB "rp-change-accepted", { view: if $scope.ui.reviewPanelOpen then $scope.reviewPanel.subView else 'mini' }
		
		$scope.rejectChange = (entry_id) ->
			$scope.$broadcast "change:reject", entry_id
			event_tracking.sendMB "rp-change-rejected", { view: if $scope.ui.reviewPanelOpen then $scope.reviewPanel.subView else 'mini' }
		
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
			thread.resolved_at = new Date()
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
		
		$scope.toggleTrackChanges = (value) ->
			if $scope.project.features.trackChanges
				$scope.editor.wantTrackChanges = value
				$http.post "/project/#{$scope.project_id}/track_changes", {_csrf: window.csrfToken, on: value}
				event_tracking.sendMB "rp-trackchanges-toggle", { value }
			else
				$scope.openTrackChangesUpgradeModal()
		
		ide.socket.on "toggle-track-changes", (value) ->
			$scope.$apply () ->
				$scope.editor.wantTrackChanges = value

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
