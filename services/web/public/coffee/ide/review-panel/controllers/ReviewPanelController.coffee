define [
	"base",
	"utils/EventEmitter"
	"ide/colors/ColorManager"
	"ide/review-panel/ChangesTracker"
], (App, EventEmitter, ColorManager, ChangesTracker) ->
	App.controller "ReviewPanelController", ($scope, $element, ide, $timeout) ->
		$reviewPanelEl = $element.find "#review-panel"

		$scope.SubViews =
			CUR_FILE : "cur_file"
			OVERVIEW : "overview"

		$scope.reviewPanel =
			entries: {}
			trackNewChanges: false
			hasEntries: false
			subView: $scope.SubViews.CUR_FILE
			openSubView: $scope.SubViews.CUR_FILE

		$scope.commentState =
			adding: false
			content: ""

		$scope.reviewPanelEventsBridge = new EventEmitter()

		changesTrackers = {}

		# TODO Just for prototyping purposes; remove afterwards.
		mockedUserId = 'mock_user_id_1'
		mockedUserId2 = 'mock_user_id_2'

		if window.location.search.match /mocktc=true/
			mock_changes = {
				"main.tex":
					changes: [{
						op: { i: "Habitat loss and conflicts with humans are the greatest causes of concern.", p: 925 - 38 }
						metadata: { user_id: mockedUserId, ts: new Date(Date.now() - 30 * 60 * 1000) }
					}, {
						op: { d: "The lion is now a vulnerable species. ", p: 778 }
						metadata: { user_id: mockedUserId, ts: new Date(Date.now() - 31 * 60 * 1000) }
					}]
					comments: [{
						offset: 1375 - 38
						length: 79
						metadata:
							thread: [{
								content: "Do we have a source for this?"
								user_id: mockedUserId
								ts: new Date(Date.now() - 45 * 60 * 1000) 
							}]
					}]
				"chapter_1.tex":
					changes: [{
						"op":{"p":740,"d":", to take down large animals"},
						"metadata":{"user_id":mockedUserId, ts: new Date(Date.now() - 15 * 60 * 1000)}
					}, {
						"op":{"i":", to keep hold of the prey","p":920},
						"metadata":{"user_id":mockedUserId, ts: new Date(Date.now() - 130 * 60 * 1000)}
					}, {
						"op":{"i":" being","p":1057},
						"metadata":{"user_id":mockedUserId2, ts: new Date(Date.now() - 72 * 60 * 1000)}
					}]
					comments:[{
						"offset":111,"length":5,
						"metadata":{
							"thread": [
								{"content":"Have we used 'pride' too much here?","user_id":mockedUserId, ts: new Date(Date.now() - 12 * 60 * 1000)},
								{"content":"No, I think this is OK","user_id":mockedUserId2, ts: new Date(Date.now() - 9 * 60 * 1000)}
							]
						}
					},{
						"offset":452,"length":21,
						"metadata":{
							"thread":[
								{"content":"TODO: Don't use as many parentheses!","user_id":mockedUserId2, ts: new Date(Date.now() - 99 * 60 * 1000)}
							]
						}
					}]
				"chapter_2.tex":
					changes: [{
						"op":{"p":458,"d":"other"},
						"metadata":{"user_id":mockedUserId, ts: new Date(Date.now() - 133 * 60 * 1000)}
					},{
						"op":{"i":"usually 2-3, ","p":928},
						"metadata":{"user_id":mockedUserId, ts: new Date(Date.now() - 27 * 60 * 1000)}
					},{
						"op":{"i":"If the parents are a male lion and a female tiger, it is called a liger. A tigon comes from a male tiger and a female lion.","p":1126},
						"metadata":{"user_id":mockedUserId, ts: new Date(Date.now() - 152 * 60 * 1000)}
					}]
					comments: [{
						"offset":299,"length":10,
						"metadata":{
							"thread":[{
								"content":"Should we use a different word here if 'den' needs clarifying?","user_id":mockedUserId,"ts": new Date(Date.now() - 430 * 60 * 1000)
							}]
						}
					},{
						"offset":843,"length":66,
						"metadata":{
							"thread":[{
								"content":"This sentence is a little ambiguous","user_id":mockedUserId,"ts": new Date(Date.now() - 430 * 60 * 1000)
							}]
						}
					}]
			}
			ide.$scope.$on "file-tree:initialized", () ->
				ide.fileTreeManager.forEachEntity (entity) ->
					if mock_changes[entity.name]?
						changesTrackers[entity.id] ?= new ChangesTracker()
						for change in mock_changes[entity.name].changes
							changesTrackers[entity.id]._addOp change.op, change.metadata 
						for comment in mock_changes[entity.name].comments
							changesTrackers[entity.id].addComment comment.offset, comment.length, comment.metadata 

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

		$scope.$watch "editor.open_doc_id", (open_doc_id) ->
			return if !open_doc_id?
			changesTrackers[open_doc_id] ?= new ChangesTracker()
			$scope.reviewPanel.changesTracker = changesTrackers[open_doc_id]

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
		
		$scope.acceptChange = (entry_id) ->
			$scope.$broadcast "change:accept", entry_id
		
		$scope.rejectChange = (entry_id) ->
			$scope.$broadcast "change:reject", entry_id
		
		$scope.startNewComment = () ->
			# $scope.commentState.adding = true
			$scope.$broadcast "comment:select_line"
			$timeout () ->
				$scope.$broadcast "review-panel:layout"
		
		$scope.submitNewComment = (content) ->
			# $scope.commentState.adding = false
			$scope.$broadcast "comment:add", content
			# $scope.commentState.content = ""
			$timeout () ->
				$scope.$broadcast "review-panel:layout"
		
		$scope.cancelNewComment = (entry) ->
			# $scope.commentState.adding = false
			# $scope.commentState.content = ""
			$timeout () ->
				$scope.$broadcast "review-panel:layout"
		
		$scope.startReply = (entry) ->
			entry.replying = true
			$timeout () ->
				$scope.$broadcast "review-panel:layout"

		# $scope.handleCommentReplyKeyPress = (ev, entry) ->
		# 	if ev.keyCode == 13 and !ev.shiftKey and !ev.ctrlKey and !ev.metaKey
		# 		ev.preventDefault()
		# 		ev.target.blur()
		# 		$scope.submitReply(entry)

		$scope.submitReply = (entry, entry_id) ->
			$scope.unresolveComment(entry_id)
			entry.thread.push {
				content: entry.replyContent
				ts: new Date()
				user_id: window.user_id
			}
			entry.replyContent = ""
			entry.replying = false
			$timeout () ->
				$scope.$broadcast "review-panel:layout"
			# TODO Just for prototyping purposes; remove afterwards
			window.setTimeout((() -> 
				$scope.$applyAsync(() -> submitMockedReply(entry))
			), 1000 * 2)

		# TODO Just for prototyping purposes; remove afterwards.
		submitMockedReply = (entry) ->
			entry.thread.push {
				content: 'Sounds good!'
				ts: new Date()
				user_id: mockedUserId
			}
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
			$scope.$broadcast "comment:resolve", entry_id
		
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
			console.log "Going to entry", entry.docPos
			ide.editorManager.openDocId(doc_id, { gotoLine: entry.docPos.row + 1, gotoColumn: entry.docPos.column })

		DOC_ID_NAMES = {} 
		$scope.getFileName = (doc_id) ->
			# This is called a lot and is relatively expensive, so cache the result
			if !DOC_ID_NAMES[doc_id]?
				entity = ide.fileTreeManager.findEntityById(doc_id)
				return if !entity?
				DOC_ID_NAMES[doc_id] = ide.fileTreeManager.getEntityPath(entity)
			return DOC_ID_NAMES[doc_id]

		# TODO: Eventually we need to get this from the server, and update it 
		# when we get an id we don't know. This'll do for client side testing
		refreshUsers = () ->
			$scope.users = {}
			# TODO Just for prototyping purposes; remove afterwards.
			$scope.users[mockedUserId] = {
				email: "paulo@sharelatex.com"
				name: "Paulo Reis"
				isSelf: false
				hue: 70
				avatar_text: "PR"
			}
			$scope.users[mockedUserId2] = {
				email: "james@sharelatex.com"
				name: "James Allen"
				isSelf: false
				hue: 320
				avatar_text: "JA"
			}

			for member in $scope.project.members.concat($scope.project.owner)
				if member._id == window.user_id
					name = "You"
					isSelf = true
				else
					name = "#{member.first_name} #{member.last_name}"
					isSelf = false

				$scope.users[member._id] = {
					email: member.email
					name: name
					isSelf: isSelf
					hue: ColorManager.getHueForUserId(member._id)
					avatar_text: [member.first_name, member.last_name].filter((n) -> n?).map((n) -> n[0]).join ""
				}
		
		$scope.$watch "project.members", (members) ->
			return if !members?
			refreshUsers()
