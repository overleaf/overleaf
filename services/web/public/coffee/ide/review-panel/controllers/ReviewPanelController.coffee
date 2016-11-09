define [
	"base",
	"utils/EventEmitter"
], (App, EventEmitter) ->
	App.controller "ReviewPanelController", ($scope, $element, ide) ->
		$scope.reviewPanel =
			entries: {}
			trackNewChanges: false
		
		$scope.commentState =
			adding: false
			content: ""
			
		scroller = $element.find(".review-panel-scroller")
		list = $element.find(".review-entry-list")

		# Use these to avoid unnecessary updates. Scrolling one
		# panel causes us to scroll the other panel, but there's no
		# need to trigger the event back to the original panel.
		ignoreNextPanelEvent = false
		ignoreNextAceEvent = false

		$scope.scrollEvents = new EventEmitter()
	
		scrollPanel = (scrollTop, height) ->
			if ignoreNextAceEvent
				ignoreNextAceEvent = false
			else
				ignoreNextPanelEvent = true
				list.height(height)
				scroller.scrollTop(scrollTop)
	
		scrollAce = (e) ->
			if ignoreNextPanelEvent
				ignoreNextPanelEvent = false
			else
				ignoreNextAceEvent = true
				$scope.scrollEvents.emit "scroll", e.target.scrollTop
				
		$scope.$watch "ui.reviewPanelOpen", (reviewPanelOpen) ->
			return if !reviewPanelOpen?
			if reviewPanelOpen
				$scope.$broadcast "review-panel:layout"
				scroller.on "scroll", scrollAce
				$scope.onScroll = scrollPanel # Passed into the editor directive for it to call
			else
				scroller.off "scroll"
				$scope.onScroll = null

		# If we listen for scroll events in the review panel natively, then with a Mac trackpad
		# the scroll is very smooth (natively done I'd guess), but we don't get polled regularly
		# enough to keep Ace in step, and it noticeably lags. If instead, we borrow the manual
		# mousewheel/trackpad scrolling behaviour from Ace, and turn mousewheel events into
		# scroll events ourselves, then it makes the review panel slightly less smooth (barely)
		# noticeable, but keeps it perfectly in step with Ace.
		ace.require("ace/lib/event").addMouseWheelListener scroller[0], (e) ->
			deltaY = e.wheelY
			# console.log "mousewheel", deltaY
			scroller.scrollTop(scroller.scrollTop() + deltaY * 4)
			e.preventDefault()
		
		$scope.startNewComment = () ->
			$scope.commentState.adding = true
			$scope.$broadcast "comment:select_line"
			$scope.$broadcast "review-panel:layout"
		
		$scope.submitNewComment = () ->
			$scope.commentState.adding = false
			$scope.$broadcast "comment:add", $scope.commentState.content
			$scope.commentState.content = ""
			$scope.$broadcast "review-panel:layout"
		
		$scope.cancelNewComment = (entry) ->
			$scope.commentState.adding = false
			$scope.commentState.content = ""
			$scope.$broadcast "review-panel:layout"
		
		$scope.startReply = (entry) ->
			entry.replying = true
			$scope.$broadcast "review-panel:layout"
		
		$scope.submitReply = (entry) ->
			entry.thread.push {
				content: entry.replyContent
				ts: new Date()
				user_id: window.user_id
			}
			entry.replyContent = ""
			entry.replying = false
			$scope.$broadcast "review-panel:layout"
		
		$scope.cancelReply = (entry) ->
			entry.replying = false
			entry.replyContent = ""
			$scope.$broadcast "review-panel:layout"