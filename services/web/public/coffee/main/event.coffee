define [
	"moment"
	"base"
	"modules/localStorage"

], (moment, App) ->
	CACHE_KEY = "mbEvents"

	# keep track of how many heartbeats we've sent so we can calculate how
	# long wait until the next one
	heartbeatsSent = 0
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

		_sendEditingSessionHeartbeat = (segmentation) ->
			$http({
				url: "/editingSession/#{window.project_id}",
				method: "PUT",
				data: segmentation,
				headers: {
					"X-CSRF-Token": window.csrfToken
				}
			})

		return {
			send: (category, action, label, value)->
				ga('send', 'event', category, action, label, value)


			editingSessionHeartbeat: (segmentation = {}) ->
				return unless nextHeartbeat <= new Date()

				_sendEditingSessionHeartbeat(segmentation)

				heartbeatsSent++

				# send two first heartbeats at 0 and 30s then increase the backoff time
				# 1min per call until we reach 5 min
				backoffSecs = if heartbeatsSent <= 2
					30
				else if heartbeatsSent <= 6
					(heartbeatsSent - 2) * 60
				else
					300

				nextHeartbeat = moment().add(backoffSecs, 'seconds').toDate()

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
