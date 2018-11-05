/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.directive('infiniteScroll', () => ({
    link(scope, element, attrs, ctrl) {
      const innerElement = element.find('.infinite-scroll-inner')
      element.css({ 'overflow-y': 'auto' })

      const atEndOfListView = function() {
        if (attrs.infiniteScrollUpwards != null) {
          return atTopOfListView()
        } else {
          return atBottomOfListView()
        }
      }

      var atTopOfListView = () => element.scrollTop() < 30

      var atBottomOfListView = () =>
        element.scrollTop() + element.height() >= innerElement.height() - 30

      const listShorterThanContainer = () =>
        element.height() > innerElement.height()

      var loadUntilFull = function() {
        if (
          (listShorterThanContainer() || atEndOfListView()) &&
          !scope.$eval(attrs.infiniteScrollDisabled)
        ) {
          const promise = scope.$eval(attrs.infiniteScroll)
          return promise.then(() => setTimeout(() => loadUntilFull(), 0))
        }
      }

      element.on('scroll', event => loadUntilFull())

      return scope.$watch(attrs.infiniteScrollInitialize, function(value) {
        if (value) {
          return loadUntilFull()
        }
      })
    }
  })))
