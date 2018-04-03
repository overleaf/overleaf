# For sending event data to metabase and google analytics
# ---
# by default,
#   event not sent to MB.
#     for MB, add event-tracking-mb='true'
#     by default, event sent to MB via sendMB
#       this can be changed to use sendMBOnce via event-tracking-send-once='true' attribute
#   event not sent to GA.
#     for GA, add event-tracking-ga attribute, where the value is the GA category
# event-tracking-trigger attribute is required to send event

define [
	'base'
], (App) ->
	App.directive 'eventTracking', ['event_tracking', (event_tracking) ->
		return {
			scope: {
				eventTracking: '@',
				eventSegmentation: '=?'
			}
			link: (scope, element, attrs) ->
				sendGA = attrs.eventTrackingGa || false
				sendMB = attrs.eventTrackingMb || false
				sendMBFunction = if attrs.eventTrackingSendOnce then 'sendMBOnce' else 'sendMB'
				segmentation = scope.eventSegmentation || {}

				segmentation.page = window.location.pathname

				sendEvent = () ->
					if sendMB
						event_tracking[sendMBFunction] scope.eventTracking, segmentation
					if sendGA
						event_tracking.send attrs.eventTrackingGa, attrs.eventTrackingAction || scope.eventTracking, attrs.eventTrackingLabel || ''

				if attrs.eventTrackingTrigger == 'load'
					sendEvent()
				else if attrs.eventTrackingTrigger == 'click'
					element.on 'click', (e) ->
						sendEvent()
		}
	]