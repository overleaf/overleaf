/* eslint-disable
    max-len,
    no-return-assign,
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
  App.directive('updateScrollBottomOn', $timeout => ({
    restrict: 'A',
    link(scope, element, attrs, ctrls) {
      // We keep the offset from the bottom fixed whenever the event fires
      //
      // ^   | ^
      // |   | | scrollTop
      // |   | v
      // |   |-----------
      // |   | ^
      // |   | |
      // |   | | clientHeight (viewable area)
      // |   | |
      // |   | |
      // |   | v
      // |   |-----------
      // |   | ^
      // |   | | scrollBottom
      // v   | v
      //  \
      //   scrollHeight

      let scrollBottom = 0
      element.on(
        'scroll',
        e =>
          (scrollBottom =
            element[0].scrollHeight -
            element[0].scrollTop -
            element[0].clientHeight)
      )

      return scope.$on(attrs.updateScrollBottomOn, () =>
        $timeout(
          () =>
            element.scrollTop(
              element[0].scrollHeight - element[0].clientHeight - scrollBottom
            ),
          0
        )
      )
    }
  })))
