# For sending event data to metabase and google analytics
# ---
# by default,
#   event not sent to MB.
#     for MB, add event-tracking-mb='true'
#     by default, event sent to MB via sendMB
#   event not sent to GA.
#     for GA, add event-tracking-ga attribute, where the value is the GA category
# Either GA or MB can use the attribute event-tracking-send-once='true' to
# send event just once
#   MB will use the key and GA will use the action to determine if the event
#   has been sent
# event-tracking-trigger attribute is required to send event

isInViewport = (element) ->
	elTop = element.offset().top
	elBtm = elTop + element.outerHeight()

	viewportTop = $(window).scrollTop()
	viewportBtm = viewportTop + $(window).height()

	elBtm > viewportTop && elTop < viewportBtm

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
				sendGAFunction = if attrs.eventTrackingSendOnce then 'sendGAOnce' else 'send'
				segmentation = scope.eventSegmentation || {}
				segmentation.page = window.location.pathname

				sendEvent = (scrollEvent) ->
					###
						@param {boolean}		scrollEvent		Use to unbind scroll event
					###
					if sendMB
						event_tracking[sendMBFunction] scope.eventTracking, segmentation
					if sendGA
						event_tracking[sendGAFunction] attrs.eventTrackingGa, attrs.eventTrackingAction || scope.eventTracking, attrs.eventTrackingLabel || ''
					if scrollEvent
						$(window).unbind('resize scroll')

				if attrs.eventTrackingTrigger == 'load'
					sendEvent()
				else if attrs.eventTrackingTrigger == 'click'
					element.on 'click', (e) ->
						sendEvent()
				else if attrs.eventTrackingTrigger == 'hover'
					timer = null
					timeoutAmt = 500
					if attrs.eventHoverAmt
						timeoutAmt = parseInt(attrs.eventHoverAmt, 10)
					element.on 'mouseenter', () ->
						timer = setTimeout((-> sendEvent()), timeoutAmt)
						return
					.on 'mouseleave', () ->
						clearTimeout(timer)
				else if attrs.eventTrackingTrigger == 'scroll'
					if !event_tracking.eventInCache(scope.eventTracking)
						$(window).on 'resize scroll', () ->
							_.throttle(
								if isInViewport(element) && !event_tracking.eventInCache(scope.eventTracking)
									sendEvent(true)
							, 500)
		}
	]
