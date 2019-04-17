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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.directive('reviewPanelToggle', () => ({
    restrict: 'E',
    scope: {
      onToggle: '&',
      ngModel: '=',
      valWhenUndefined: '=?',
      isDisabled: '=?',
      onDisabledClick: '&?',
      description: '@'
    },
    link(scope) {
      if (scope.disabled == null) {
        scope.disabled = false
      }
      scope.onChange = (...args) => scope.onToggle({ isOn: scope.localModel })
      scope.handleClick = function() {
        if (scope.disabled && scope.onDisabledClick != null) {
          return scope.onDisabledClick()
        }
      }
      scope.localModel = scope.ngModel
      return scope.$watch('ngModel', function(value) {
        if (scope.valWhenUndefined != null && value == null) {
          value = scope.valWhenUndefined
        }
        return (scope.localModel = value)
      })
    },

    template: `\
<fieldset class="rp-toggle" ng-click="handleClick();">
  <legend class="sr-only">{{description}}</legend>
  <input id="rp-toggle-{{$id}}" ng-disabled="isDisabled" type="checkbox" class="rp-toggle-hidden-input" ng-model="localModel" ng-change="onChange()" />
  <label for="rp-toggle-{{$id}}" class="rp-toggle-btn"></label>
</fieldset>\
`
  })))
