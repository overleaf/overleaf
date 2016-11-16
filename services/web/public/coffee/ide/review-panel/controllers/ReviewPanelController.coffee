define [
	"base",
	"utils/EventEmitter"
	"ide/colors/ColorManager"
	"ide/review-panel/ChangesTracker"
], (App, EventEmitter, ColorManager, ChangesTracker) ->
	App.controller "ReviewPanelController", ($scope, $element, ide, $timeout) ->
		$scope.SubViews =
			CUR_FILE : "cur_file"
			OVERVIEW : "overview"

		$scope.reviewPanel =
			entries: {}
			trackNewChanges: false
			hasEntries: false
			subView: $scope.SubViews.CUR_FILE

		$scope.commentState =
			adding: false
			content: ""

		# Used to communicate between Ace and reviewPanelSorted directive
		$scope.scrollBindings =
			reviewPanelEvents: new EventEmitter()

		changesTrackers = {}

		$scope.$watch "editor.open_doc_id", (open_doc_id) ->
			return if !open_doc_id?
			changesTrackers[open_doc_id] ?= new ChangesTracker()
			$scope.reviewPanel.changesTracker = changesTrackers[open_doc_id]

		# TODO Just for prototyping purposes; remove afterwards.
		mockedUserId = '12345abc'

		#TODO: Doesn't work anymore now entries is first indexed by doc_id
		$scope.$watch (() -> Object.keys($scope.reviewPanel.entries).length), (nEntries) ->
			$scope.reviewPanel.hasEntries = nEntries > 0
		
		$scope.acceptChange = (entry_id) ->
			$scope.$broadcast "change:accept", entry_id
		
		$scope.rejectChange = (entry_id) ->
			$scope.$broadcast "change:reject", entry_id
		
		$scope.startNewComment = () ->
			# $scope.commentState.adding = true
			$scope.$broadcast "comment:select_line"
			$scope.$broadcast "review-panel:layout"
		
		$scope.submitNewComment = (content) ->
			console.log(content)
			# $scope.commentState.adding = false
			$scope.$broadcast "comment:add", content
			# $scope.commentState.content = ""
			$scope.$broadcast "review-panel:layout"
		
		$scope.cancelNewComment = (entry) ->
			# $scope.commentState.adding = false
			# $scope.commentState.content = ""
			$scope.$broadcast "review-panel:layout"
		
		$scope.startReply = (entry) ->
			entry.replying = true
			$scope.$broadcast "review-panel:layout"

		# $scope.handleCommentReplyKeyPress = (ev, entry) ->
		# 	if ev.keyCode == 13 and !ev.shiftKey and !ev.ctrlKey and !ev.metaKey
		# 		ev.preventDefault()
		# 		ev.target.blur()
		# 		$scope.submitReply(entry)

		$scope.submitReply = (entry) ->
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
				content: 'Lorem ipsum dolor sit amet'
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
		
		$scope.setSubView = (subView) -> 
			$scope.reviewPanel.subView = subView
			
		# TODO: Eventually we need to get this from the server, and update it 
		# when we get an id we don't know. This'll do for client side testing
		refreshUsers = () ->
			$scope.users = {}
			# TODO Just for prototyping purposes; remove afterwards.
			$scope.users[mockedUserId] = {
				email: "gerald.butler@gmail.com"
				name: "Gerald Butler"
				isSelf: false
				hue: 70
				avatar_text: "G"
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
