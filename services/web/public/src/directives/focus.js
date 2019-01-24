/* eslint-disable
    no-return-assign,
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
define(['base'], function(App) {
  let selectName
  App.directive('focusWhen', $timeout => ({
    restrict: 'A',
    link(scope, element, attr) {
      return scope.$watch(attr.focusWhen, function(value) {
        if (value) {
          return $timeout(() => element.focus())
        }
      })
    }
  }))

  App.directive('focusOn', $timeout => ({
    restrict: 'A',
    link(scope, element, attrs) {
      return scope.$on(attrs.focusOn, () => element.focus())
    }
  }))

  App.directive('selectWhen', $timeout => ({
    restrict: 'A',
    link(scope, element, attr) {
      return scope.$watch(attr.selectWhen, function(value) {
        if (value) {
          return $timeout(() => element.select())
        }
      })
    }
  }))

  App.directive('selectOn', $timeout => ({
    restrict: 'A',
    link(scope, element, attrs) {
      return scope.$on(attrs.selectOn, () => element.select())
    }
  }))

  App.directive('selectNameWhen', $timeout => ({
    restrict: 'A',
    link(scope, element, attrs) {
      return scope.$watch(attrs.selectNameWhen, function(value) {
        if (value) {
          return $timeout(() => selectName(element))
        }
      })
    }
  }))

  App.directive('selectNameOn', () => ({
    restrict: 'A',
    link(scope, element, attrs) {
      return scope.$on(attrs.selectNameOn, () => selectName(element))
    }
  }))

  App.directive('focus', $timeout => ({
    scope: {
      trigger: '@focus'
    },

    link(scope, element) {
      return scope.$watch('trigger', function(value) {
        if (value === 'true') {
          return $timeout(() => element[0].focus())
        }
      })
    }
  }))

  selectName = function(element) {
    // Select up to last '.'. I.e. everything except the file extension
    element.focus()
    const name = element.val()
    if (element[0].setSelectionRange != null) {
      let selectionEnd = name.lastIndexOf('.')
      if (selectionEnd === -1) {
        selectionEnd = name.length
      }
      return element[0].setSelectionRange(0, selectionEnd)
    }
  }
})
