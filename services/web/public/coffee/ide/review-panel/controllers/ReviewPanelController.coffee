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
			commentThreads: {}

		$scope.commentState =
			adding: false
			content: ""

		$scope.reviewPanelEventsBridge = new EventEmitter()
		
		$http.get "/project/#{$scope.project_id}/threads"
			.success (threads) ->
				for thread_id, comments of threads
					for comment in comments
						formatComment(comment)
				$scope.reviewPanel.commentThreads = threads
		
		ide.socket.on "new-comment", (thread_id, comment) ->
			$scope.reviewPanel.commentThreads[thread_id] ?= []
			$scope.reviewPanel.commentThreads[thread_id].push(formatComment(comment))
			$scope.$apply()
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

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
		
		$scope.$watch "reviewPanel.subView", (subView) ->
			return if !subView?
			updateScrollbar()
		
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
			if view == $scope.SubViews.OVERVIEW
				refreshOverviewPanel()

		$scope.$watch "editor.sharejs_doc", (doc) ->
			return if !doc?
			# The open doc range tracker is kept up to date in real-time so
			# replace any outdated info with this
			rangesTrackers[doc.doc_id] = doc.ranges
			$scope.reviewPanel.rangesTracker = rangesTrackers[doc.doc_id]

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
		
		refreshOverviewPanel = () ->
			$scope.reviewPanel.overview.loading = true
			$http.get "/project/#{$scope.project_id}/ranges"
				.success (docs) ->
					for doc in docs
						if doc.id != $scope.editor.open_doc_id # this is kept up to date in real-time, don't overwrite
							rangesTrackers[doc.id] ?= new RangesTracker()
							rangesTrackers[doc.id].comments = doc.ranges?.comments or []
							rangesTrackers[doc.id].changes = doc.ranges?.changes or []
							updateEntries(doc.id)
					$scope.reviewPanel.overview.loading = false
				.error (error) ->
					console.log "loading ranges errored", error
					$scope.reviewPanel.overview.loading = false
		
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

			for comment in rangesTracker.comments
				delete delete_changes[comment.id]
				entries[comment.id] ?= {}
				new_entry = {
					type: "comment"
					thread_id: comment.op.t
					resolved: comment.metadata?.resolved
					resolved_data: comment.metadata?.resolved_data
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
		
		$scope.acceptChange = (entry_id) ->
			$scope.$broadcast "change:accept", entry_id
		
		$scope.rejectChange = (entry_id) ->
			$scope.$broadcast "change:reject", entry_id
		
		$scope.startNewComment = () ->
			$scope.$broadcast "comment:select_line"
			$timeout () ->
				$scope.$broadcast "review-panel:layout"
		
		$scope.submitNewComment = (content) ->
			thread_id = RangesTracker.newId()
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
			$scope.unresolveComment(entry_id)
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
			$scope.$broadcast "comment:resolve", entry_id, window.user_id
		
		$scope.unresolveComment = (entry_id) ->
			$scope.$broadcast "comment:unresolve", entry_id
		
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

		# TODO: Eventually we need to get this from the server, and update it 
		# when we get an id we don't know. This'll do for client side testing
		refreshUsers = () ->
			$scope.users = {}
			for member in $scope.project.members.concat($scope.project.owner)
				$scope.users[member._id] = formatUser(member)

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
		
		$scope.$watch "project.members", (members) ->
			return if !members?
			refreshUsers()
