define [
	"base",
	"utils/EventEmitter"
	"ide/colors/ColorManager"
	"ide/review-panel/RangesTracker"
], (App, EventEmitter, ColorManager, RangesTracker) ->
	App.controller "ReviewPanelController", ($scope, $element, ide, $timeout, $http) ->
		$reviewPanelEl = $element.find "#review-panel"

		$scope.SubViews =
			CUR_FILE : "cur_file"
			OVERVIEW : "overview"

		$scope.reviewPanel =
			entries: {}
			hasEntries: false
			subView: $scope.SubViews.CUR_FILE
			openSubView: $scope.SubViews.CUR_FILE
			overview:
				loading: false
			dropdown:
				loading: false
			commentThreads: {}

		$scope.commentState =
			adding: false
			content: ""

		$scope.users = {}

		$scope.reviewPanelEventsBridge = new EventEmitter()
		
		ide.socket.on "new-comment", (thread_id, comment) ->
			$scope.reviewPanel.commentThreads[thread_id] ?= { messages: [] }
			$scope.reviewPanel.commentThreads[thread_id].messages.push(formatComment(comment))
			$scope.$apply()
			$timeout () ->
				$scope.$broadcast "review-panel:layout"
		
		ide.socket.on "accept-change", (doc_id, change_id) ->
			console.log "Got remote accept change", doc_id, change_id
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

		rangesTrackers = {}

		getDocEntries = (doc_id) ->
			$scope.reviewPanel.entries[doc_id] ?= {}
			return $scope.reviewPanel.entries[doc_id]

		getChangeTracker = (doc_id) ->
			rangesTrackers[doc_id] ?= new RangesTracker()
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
			$scope.reviewPanel.hasEntries = nEntries > 0 and $scope.trackChangesFeatureFlag

		$scope.$watch "ui.reviewPanelOpen", (reviewPanelOpen) ->
			return if !reviewPanelOpen?
			$timeout () ->
				$scope.$broadcast "review-panel:toggle"
				$scope.$broadcast "review-panel:layout"
		
		generatePartialMongoId = () ->
			# Generate a the first 18 characters of Mongo ObjectId, leaving 6 for the increment part
			# Reference: https://github.com/dreampulse/ObjectId.js/blob/master/src/main/javascript/Objectid.js
			pid = Math.floor(Math.random() * (32767)).toString(16)
			machine = Math.floor(Math.random() * (16777216)).toString(16)
			timestamp = Math.floor(new Date().valueOf() / 1000).toString(16)
			return '00000000'.substr(0, 8 - timestamp.length) + timestamp +
				'000000'.substr(0, 6 - machine.length) + machine +
				'0000'.substr(0, 4 - pid.length) + pid
		
		generateFullMongoId = () ->
			return generatePartialMongoId() + "000000"
		
		regenerateTrackChangesId = (doc) ->
			old_id = getChangeTracker(doc.doc_id).getIdSeed()
			new_id = generatePartialMongoId()
			getChangeTracker(doc.doc_id).setIdSeed(new_id)
			doc.setTrackChangesIdSeeds({pending: new_id, inflight: old_id})
		
		refreshRanges = () ->
			$http.get "/project/#{$scope.project_id}/ranges"
				.success (docs) ->
					for doc in docs
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
			refreshRanges()
				.then () ->
					$scope.reviewPanel.dropdown.loading = false
				.catch () ->
					$scope.reviewPanel.dropdown.loading = false

		updateEntries = (doc_id) ->
			rangesTracker = getChangeTracker(doc_id)
			entries = getDocEntries(doc_id)
			
			# Assume we'll delete everything until we see it, then we'll remove it from this object
			delete_changes = {}
			delete_changes[change_id] = true for change_id, change of entries

			for change in rangesTracker.changes
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

			for comment in rangesTracker.comments
				delete delete_changes[comment.id]
				entries[comment.id] ?= {}
				new_entry = {
					type: "comment"
					thread_id: comment.op.t
					content: comment.op.c
					offset: comment.op.p
				}
				for key, value of new_entry
					entries[comment.id][key] = value

			for change_id, _ of delete_changes
				delete entries[change_id]

		$scope.$on "editor:track-changes:changed", () ->
			doc_id = $scope.editor.open_doc_id
			updateEntries(doc_id)
			$scope.$broadcast "review-panel:recalculate-screen-positions"
			$scope.$broadcast "review-panel:layout"
		
		$scope.$on "editor:focus:changed", (e, cursor_offset, selection) ->
			doc_id = $scope.editor.open_doc_id
			entries = getDocEntries(doc_id)

			if !selection
				delete entries["add-comment"]
			else
				entries["add-comment"] = {
					type: "add-comment"
					offset: cursor_offset
				}
			
			for id, entry of entries
				if entry.type == "comment" and not entry.resolved
					entry.focused = (entry.offset <= cursor_offset <= entry.offset + entry.content.length)
				else if entry.type == "insert"
					entry.focused = (entry.offset <= cursor_offset <= entry.offset + entry.content.length)
				else if entry.type == "delete"
					entry.focused = (entry.offset == cursor_offset)
				else if entry.type == "add-comment" and selection
					entry.focused = true
			
			$scope.$broadcast "review-panel:recalculate-screen-positions"
			$scope.$broadcast "review-panel:layout"

		$scope.$on "comment:removed", (comment) ->
			console.log comment

		$scope.acceptChange = (entry_id) ->
			$http.post "/project/#{$scope.project_id}/doc/#{$scope.editor.open_doc_id}/changes/#{entry_id}/accept", {_csrf: window.csrfToken}
			$scope.$broadcast "change:accept", entry_id
		
		$scope.rejectChange = (entry_id) ->
			$scope.$broadcast "change:reject", entry_id
		
		$scope.startNewComment = () ->
			$scope.$broadcast "comment:select_line"
			$timeout () ->
				$scope.$broadcast "review-panel:layout"
		
		$scope.submitNewComment = (content) ->
			thread_id = generateFullMongoId()
			$scope.$broadcast "comment:add", thread_id
			$http.post("/project/#{$scope.project_id}/thread/#{thread_id}/messages", {content, _csrf: window.csrfToken})
				.error (error) ->
					ide.showGenericMessageModal("Error submitting comment", "Sorry, there was a problem submitting your comment")
			$timeout () ->
				$scope.$broadcast "review-panel:layout"
		
		$scope.cancelNewComment = (entry) ->
			$timeout () ->
				$scope.$broadcast "review-panel:layout"
		
		$scope.startReply = (entry) ->
			entry.replying = true
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

		$scope.submitReply = (entry, entry_id) ->
			$scope.unresolveComment(entry, entry_id)
			thread_id = entry.thread_id
			content   = entry.replyContent
			$http.post("/project/#{$scope.project_id}/thread/#{thread_id}/messages", {content, _csrf: window.csrfToken})
				.error (error) ->
					ide.showGenericMessageModal("Error submitting comment", "Sorry, there was a problem submitting your comment")

			entry.replyContent = ""
			entry.replying = false
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

		$scope.cancelReply = (entry) ->
			entry.replying = false
			entry.replyContent = ""
			$scope.$broadcast "review-panel:layout"

		$scope.resolveComment = (entry, entry_id) ->
			entry.showWhenResolved = false
			entry.focused = false
			$http.post "/project/#{$scope.project_id}/thread/#{entry.thread_id}/resolve", {_csrf: window.csrfToken}
			_onCommentResolved(entry.thread_id, ide.$scope.user)

		$scope.unresolveComment = (thread_id) ->
			_onCommentReopened(thread_id)
			$http.post "/project/#{$scope.project_id}/thread/#{thread_id}/reopen", {_csrf: window.csrfToken}
		
		_onCommentResolved = (thread_id, user) ->
			thread = $scope.reviewPanel.commentThreads[thread_id]
			thread.resolved = true
			thread.resolved_by_user = formatUser(user)
			thread.resolved_at = new Date()
			$scope.$broadcast "comment:resolve_thread", thread_id
		
		_onCommentReopened = (thread_id) ->
			thread = $scope.reviewPanel.commentThreads[thread_id]
			delete thread.resolved
			delete thread.resolved_by_user
			delete thread.resolved_at
			$scope.$broadcast "comment:unresolve_thread", thread_id
		
		$scope.deleteComment = (entry_id) ->
			$scope.$broadcast "comment:remove", entry_id

		$scope.showThread = (entry) ->
			entry.showWhenResolved = true
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

		$scope.hideThread = (entry) ->
			entry.showWhenResolved = false
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

		$scope.setSubView = (subView) -> 
			$scope.reviewPanel.subView = subView
						
		$scope.gotoEntry = (doc_id, entry) ->
			ide.editorManager.openDocId(doc_id, { gotoOffset: entry.offset })

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

			$http.get "/project/#{$scope.project_id}/ranges/users"
				.success (users) ->
					_refreshingRangeUsers = false
					$scope.users = {}
					for user in users
						$scope.users[user.id] = formatUser(user)
				.error () ->
					_refreshingRangeUsers = false

		refreshThreads = () ->
			$http.get "/project/#{$scope.project_id}/threads"
				.success (threads) ->
					for thread_id, thread of threads
						for comment in thread.messages
							formatComment(comment)
						if thread.resolved_by_user?
							$scope.$broadcast "comment:resolve_thread", thread_id
							thread.resolved_by_user = formatUser(thread.resolved_by_user)
					$scope.reviewPanel.commentThreads = threads

		refreshThreads()

		formatComment = (comment) ->
			comment.user = formatUser(user)
			comment.timestamp = new Date(comment.timestamp)
			return comment

		formatUser = (user) ->
			if !user?
				return {
					email: null
					name: "Anonymous"
					isSelf: false
					hue: ColorManager.ANONYMOUS_HUE
					avatar_text: "A"
				}

			id = user._id or user.id
			if id == window.user_id
				name = "You"
				isSelf = true
			else
				name = "#{user.first_name} #{user.last_name}"
				isSelf = false
			return {
				id: id
				email: user.email
				name: name
				isSelf: isSelf
				hue: ColorManager.getHueForUserId(id)
				avatar_text: [user.first_name, user.last_name].filter((n) -> n?).map((n) -> n[0]).join ""
			}
