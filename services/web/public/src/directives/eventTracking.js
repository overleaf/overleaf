/* eslint-disable
    camelcase,
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// For sending event data to metabase and google analytics
// ---
// by default,
//   event not sent to MB.
//     for MB, add event-tracking-mb='true'
//     by default, event sent to MB via sendMB
//   event not sent to GA.
//     for GA, add event-tracking-ga attribute, where the value is the GA category
// Either GA or MB can use the attribute event-tracking-send-once='true' to
// send event just once
//   MB will use the key and GA will use the action to determine if the event
//   has been sent
// event-tracking-trigger attribute is required to send event

const isInViewport = function(element) {
  const elTop = element.offset().top
  const elBtm = elTop + element.outerHeight()

  const viewportTop = $(window).scrollTop()
  const viewportBtm = viewportTop + $(window).height()

  return elBtm > viewportTop && elTop < viewportBtm
}

define(['base'], App =>
  App.directive('eventTracking', event_tracking => ({
    scope: {
      eventTracking: '@',
      eventSegmentation: '=?'
    },
    link(scope, element, attrs) {
      const sendGA = attrs.eventTrackingGa || false
      const sendMB = attrs.eventTrackingMb || false
      const sendMBFunction = attrs.eventTrackingSendOnce
        ? 'sendMBOnce'
        : 'sendMB'
      const sendGAFunction = attrs.eventTrackingSendOnce ? 'sendGAOnce' : 'send'
      const segmentation = scope.eventSegmentation || {}
      segmentation.page = window.location.pathname

      const sendEvent = function(scrollEvent) {
        /*
						@param {boolean}		scrollEvent		Use to unbind scroll event
					*/
        if (sendMB) {
          event_tracking[sendMBFunction](scope.eventTracking, segmentation)
        }
        if (sendGA) {
          event_tracking[sendGAFunction](
            attrs.eventTrackingGa,
            attrs.eventTrackingAction || scope.eventTracking,
            attrs.eventTrackingLabel || ''
          )
        }
        if (scrollEvent) {
          return $(window).unbind('resize scroll')
        }
      }

      if (attrs.eventTrackingTrigger === 'load') {
        return sendEvent()
      } else if (attrs.eventTrackingTrigger === 'click') {
        return element.on('click', e => sendEvent())
      } else if (attrs.eventTrackingTrigger === 'hover') {
        let timer = null
        let timeoutAmt = 500
        if (attrs.eventHoverAmt) {
          timeoutAmt = parseInt(attrs.eventHoverAmt, 10)
        }
        return element
          .on('mouseenter', function() {
            timer = setTimeout(() => sendEvent(), timeoutAmt)
          })
          .on('mouseleave', () => clearTimeout(timer))
      } else if (attrs.eventTrackingTrigger === 'scroll') {
        if (!event_tracking.eventInCache(scope.eventTracking)) {
          return $(window).on('resize scroll', () =>
            _.throttle(
              isInViewport(element) &&
              !event_tracking.eventInCache(scope.eventTracking)
                ? sendEvent(true)
                : undefined,
              500
            )
          )
        }
      }
    }
  })))
