/* eslint-disable
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
define(['base'], App =>
  App.directive('videoPlayState', $parse => ({
    restrict: 'A',
    link(scope, element, attrs) {
      const videoDOMEl = element[0]
      return scope.$watch(() => $parse(attrs.videoPlayState)(scope), function(
        shouldPlay
      ) {
        if (shouldPlay) {
          videoDOMEl.currentTime = 0
          return videoDOMEl.play()
        } else {
          return videoDOMEl.pause()
        }
      })
    }
  })))
