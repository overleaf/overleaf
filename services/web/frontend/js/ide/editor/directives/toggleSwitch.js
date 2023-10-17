import App from '../../../base'

export default App.directive('toggleSwitch', function () {
  return {
    restrict: 'E',
    scope: {
      description: '@',
      labelFalse: '@',
      labelTrue: '@',
      ngModel: '=',
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
  <label for="toggle-switch-false-{{$id}}" class="toggle-switch-label"><span>{{labelFalse}}</span></label>

  <input
    type="radio"
    class="toggle-switch-input"
    name="toggle-switch-{{$id}}"
    id="toggle-switch-true-{{$id}}"
    ng-value="true"
    ng-model="ngModel"
  >
  <label for="toggle-switch-true-{{$id}}" class="toggle-switch-label"><span>{{labelTrue}}</span></label>
</fieldset>\
`,
  }
})
