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
  App.directive('toggleSwitch', () => ({
    restrict: 'E',
    scope: {
      description: '@',
      labelFalse: '@',
      labelTrue: '@',
      ngModel: '='
    },
    template: `\
<fieldset class="toggle-switch">
    <legend class="sr-only">{{description}}</legend>

    <input
      type="radio"
      name="toggle-switch-{{$id}}"
      class="toggle-switch-input"
      id="toggle-switch-false-{{$id}}"
      ng-value="false"
      ng-model="ngModel"
    >
    <label for="toggle-switch-false-{{$id}}" class="toggle-switch-label">{{labelFalse}}</label>

    <input
      type="radio"
      class="toggle-switch-input"
      name="toggle-switch-{{$id}}"
      id="toggle-switch-true-{{$id}}"
      ng-value="true"
      ng-model="ngModel"
    >
    <label for="toggle-switch-true-{{$id}}" class="toggle-switch-label">{{labelTrue}}</label>

    <span class="toggle-switch-selection" aria-hidden="true"></span>
</fieldset>\
`
  })))
