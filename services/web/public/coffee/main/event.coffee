define [
	"base"
], (App) ->
	CACHE_KEY = "countlyEvents"

	_getEventCache = () -> 
		eventCacheStr = window.localStorage.getItem CACHE_KEY

		# Initialize as an empy object if the event cache is still empty.
		if !eventCacheStr?
			eventCacheStr = "{}"

			# Errors writing to localStorage may happen when quota is full or
			# browser is in incognito mode. We'll return an empty object, anyway.
			try
				window.localStorage.setItem CACHE_KEY, eventCacheStr 

		return JSON.parse eventCacheStr

	_eventInCache = (key) ->
		curCache = _getEventCache()

		if (curCache.hasOwnProperty key) 
			curCache[key]
		else
			false

	_addEventToCache = (key) ->
		curCache = _getEventCache()
		curCache[key] = true
		curCacheAsStr  = JSON.stringify curCache

		# Protection against issues mentioned above.
		try
			window.localStorage.setItem CACHE_KEY, curCacheAsStr


	App.factory "event_tracking", ->
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
