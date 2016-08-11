define [
	"base"
	"modules/localStorage"
], (App) ->
	CACHE_KEY = "mbEvents"

	send = (category, action, attributes = {})->
		ga('send', 'event', category, action)
		event_name = "#{action}-#{category}"
		Intercom?("trackEvent", event_name, attributes)
		
	App.factory "event_tracking", ($http, localStorage) ->
		_getEventCache = () -> 
			eventCache = localStorage CACHE_KEY

			# Initialize as an empy object if the event cache is still empty.
			if !eventCache?
				eventCache = {}
				localStorage CACHE_KEY, eventCache 

			return eventCache

		_eventInCache = (key) ->
			curCache = _getEventCache()
			curCache[key] || false

		_addEventToCache = (key) ->
			curCache = _getEventCache()
			curCache[key] = true

			localStorage CACHE_KEY, curCache

		return {
			send: (category, action, label, value)->
				ga('send', 'event', category, action, label, value)

			sendMB: (key, segmentation = {}) ->
				$http {
					url: "/event/#{key}",
					method: "POST",
					data: segmentation
					headers: {
						"X-CSRF-Token": window.csrfToken
					}
				}

			sendMBSampled: (key, segmentation) ->
				@sendMB key, segmentation if Math.random() < .01 

			sendMBOnce: (key, segmentation) ->
				if ! _eventInCache(key)
					_addEventToCache(key)
					@sendMB key, segmentation
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
