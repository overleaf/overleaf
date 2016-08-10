define [
	"base"
	"modules/localStorage"
], (App) ->
	CACHE_KEY = "countlyEvents"
	send = (category, action, attributes = {})->
		ga('send', 'event', category, action)
		event_name = "#{action}-#{category}"
		Intercom?("trackEvent", event_name, attributes)
		

	App.factory "event_tracking", (localStorage) ->
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

			sendCountly: (key, segmentation) ->
				eventData = { key }
				eventData.segmentation = segmentation if segmentation?				
				Countly?.q.push([ "add_event", eventData ])

			sendCountlySampled: (key, segmentation) ->
				@sendCountly key, segmentation if Math.random() < .01 

			sendCountlyOnce: (key, segmentation) ->
				if ! _eventInCache(key)
					_addEventToCache(key)
					@sendCountly key, segmentation
			
			send: (category, action, attributes = {})->
				event_name = "#{action}-#{category}"
				$.ajax {
					url: "/event/#{event_name}",
					method: "POST",
					data: attributes,
					dataType: "json",
					headers: {
						"X-CSRF-Token": window.csrfToken
					}
				}
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
