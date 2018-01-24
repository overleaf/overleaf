define [
	"moment"
	"base"
	"modules/localStorage"

], (moment, App) ->
	CACHE_KEY = "mbEvents"

	# Keep track of when the editing session started and when we should
	# send the next heartbeat so we can space them properly
	sessionStart  = new Date()
	nextHeartbeat = new Date()

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


			editingSessionHeartbeat: (segmentation = {}) ->
				return unless nextHeartbeat <= new Date()

				@_sendEditingSessionHeartbeat(segmentation)

				sessionDuration = (new Date().getTime() - sessionStart.getTime())/1000

				backoffSecs = switch
					when sessionDuration < 60  then 30
					when sessionDuration < 300 then 60
					else 300

				nextHeartbeat = moment().add(backoffSecs, 'seconds').toDate()

			_sendEditingSessionHeartbeat: (segmentation) ->
				$http({
					url: "/editingSession/#{window.project_id}",
					method: "PUT",
					data: segmentation,
					headers: {
						"X-CSRF-Token": window.csrfToken
					}
				})

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


	#header
	$('.navbar a').on "click", (e)->
		href = $(e.target).attr("href")
		if href?
			ga('send', 'event', 'navigation', 'top menu bar', href)
