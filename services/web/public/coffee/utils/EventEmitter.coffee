define [], () ->
	class EventEmitter
		on: (event, callback) ->
			@events ||= {}
			[event, namespace] = event.split(".")
			@events[event] ||= []
			@events[event].push {
				callback: callback
				namespace: namespace
			}

		off: (event) ->
			@events ||= {}
			if event?
				[event, namespace] = event.split(".")
				if !namespace?
					# Clear all listeners for event
					delete @events[event]
				else
					# Clear only namespaced listeners
					remaining_events = []
					for callback in @events[event] or []
						if callback.namespace != namespace
							remaining_events.push callback
					@events[event] = remaining_events
			else
				# Remove all listeners
				@events = {}

		trigger: (event, args...) ->
			@events ||= {}
			for callback in @events[event] or []
				callback.callback(args...)

		emit: (args...) -> @trigger(args...)
