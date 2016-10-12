define [
	"base",
	"utils/EventEmitter"
], (App, EventEmitter) ->
	App.controller "ReviewPanelController", ($scope, $element) ->
		$scope.reviewPanel =
			entries: {}
			
		scroller = $element.find(".review-panel-scroller")
		list = $element.find(".review-entry-list")

		ignoreNextPanelEvent = false
		ignoreNextAceEvent = false

		$scope.onScroll = (scrollTop, height) ->
			if ignoreNextAceEvent
				# console.log "Ignoring ace event"
				ignoreNextAceEvent = false
			else
				ignoreNextPanelEvent = true
				list.height(height)
				scroller.scrollTop(scrollTop)
		
		$scope.scrollEvents = new EventEmitter()
	
		scrollAce = (e) ->
			now = new Date()
			if ignoreNextPanelEvent
				# console.log "Ignoring review panel event"
				ignoreNextPanelEvent = false
			else
				# console.log "review panel scrolled", e
				ignoreNextAceEvent = true
				$scope.scrollEvents.emit "scroll", e.target.scrollTop
				lastScroll = now

		previousScroll = new Date()
		scroller.on "scroll", scrollAce
		ace.require("ace/lib/event").addMouseWheelListener scroller[0], (e) ->
			deltaY = e.wheelY
			# console.log "mousewheel", deltaY
			scroller.scrollTop(scroller.scrollTop() + deltaY * 4)
			e.preventDefault()