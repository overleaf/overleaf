define [
	"base"
], (App) ->

	App.factory "event_tracking", ->
		return {
			send: (category, action, label, value)->
				ga('send', 'event', category, action, label, value)

			sendCountly: (key, segmentation) ->
				eventData = { key }
				eventData.segmentation = segmentation if segmentation?

				Countly.q.push([ "add_event", eventData ]);
		}

	# App.directive "countlyTrack", () ->
	# 	return {
	# 		restrict: "A"
	# 		scope: false,
	# 		link: (scope, el, attrs) ->
	# 			eventKey  = attrs.countlyTrack
	# 			if (eventKey?)
	# 				el.on "click", () ->
	# 					console.log eventKey
	# 	}

	#header
	$('.navbar a').on "click", (e)->
		href = $(e.target).attr("href")
		if href?
			ga('send', 'event', 'navigation', 'top menu bar', href)
