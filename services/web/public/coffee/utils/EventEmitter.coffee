define [], () ->
	# Simple event emitter implementation, but has a slightly unusual API for
	# removing specific listeners. If a specific listener needs to be removed
	# (instead of all listeners), then it needs to use a "namespace":
	# Create a listener on the foo event with bar namespace: .on 'foo.bar'
	# Trigger all events for the foo event (including namespaces): .trigger 'foo'
	# Remove all listeners for the foo event (including namespaces): .off 'foo'
	# Remove a listener for the foo event with the bar namespace: .off 'foo.bar'
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
