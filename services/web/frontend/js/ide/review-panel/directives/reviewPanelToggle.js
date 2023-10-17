/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../../../base'

export default App.directive('reviewPanelToggle', function () {
  return {
    restrict: 'E',
    scope: {
      onToggle: '&',
      ngModel: '=',
      valWhenUndefined: '=?',
      isDisabled: '=?',
      onDisabledClick: '&?',
      description: '@',
    },
    link(scope) {
      if (scope.disabled == null) {
        scope.disabled = false
      }
      scope.onChange = (...args) => scope.onToggle({ isOn: scope.localModel })
      scope.handleClick = function () {
        if (scope.disabled && scope.onDisabledClick != null) {
          return scope.onDisabledClick()
        }
      }
      scope.localModel = scope.ngModel
      return scope.$watch('ngModel', function (value) {
        if (scope.valWhenUndefined != null && value == null) {
          value = scope.valWhenUndefined
        }
        return (scope.localModel = value)
      })
    },

    template: `\
<fieldset class="input-switch" ng-click="handleClick();">
<legend class="sr-only">{{description}}</legend>
<input id="input-switch-{{$id}}" ng-disabled="isDisabled" type="checkbox" class="input-switch-hidden-input" ng-model="localModel" ng-change="onChange()" />
<label for="input-switch-{{$id}}" class="input-switch-btn"></label>
</fieldset>\
`,
  }
})
