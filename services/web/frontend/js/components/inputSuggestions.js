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
define(['base'], function(App) {
  const inputSuggestionsController = function($scope, $element, $attrs, Keys) {
    const ctrl = this
    ctrl.showHint = false
    ctrl.hasFocus = false
    ctrl.handleFocus = function() {
      ctrl.hasFocus = true
      return (ctrl.suggestion = null)
    }
    ctrl.handleBlur = function() {
      ctrl.showHint = false
      ctrl.hasFocus = false
      ctrl.suggestion = null
      return ctrl.onBlur()
    }
    ctrl.handleKeyDown = function($event) {
      if (
        ($event.which === Keys.TAB || $event.which === Keys.ENTER) &&
        ctrl.suggestion != null &&
        ctrl.suggestion !== ''
      ) {
        $event.preventDefault()
        ctrl.localNgModel += ctrl.suggestion
      }
      ctrl.suggestion = null
      return (ctrl.showHint = false)
    }
    $scope.$watch('$ctrl.localNgModel', function(newVal, oldVal) {
      if (ctrl.hasFocus && newVal !== oldVal) {
        ctrl.suggestion = null
        ctrl.showHint = false
        return ctrl
          .getSuggestion({ userInput: newVal })
          .then(function(suggestion) {
            if (suggestion != null && newVal === ctrl.localNgModel) {
              ctrl.showHint = true
              return (ctrl.suggestion = suggestion.replace(newVal, ''))
            }
          })
          .catch(() => (ctrl.suggestion = null))
      }
    })
  }

  return App.component('inputSuggestions', {
    bindings: {
      localNgModel: '=ngModel',
      localNgModelOptions: '=?ngModelOptions',
      getSuggestion: '&',
      onBlur: '&?',
      inputId: '@?',
      inputName: '@?',
      inputPlaceholder: '@?',
      inputType: '@?',
      inputRequired: '=?'
    },
    controller: inputSuggestionsController,
    template: [
      '<div class="input-suggestions">',
      '<div class="form-control input-suggestions-shadow">',
      '<span ng-bind="$ctrl.localNgModel"',
      ' class="input-suggestions-shadow-existing"',
      ' ng-show="$ctrl.showHint">',
      '</span>',
      '<span ng-bind="$ctrl.suggestion"',
      ' class="input-suggestions-shadow-suggested"',
      ' ng-show="$ctrl.showHint">',
      '</span>',
      '</div>',
      '<input type="text"',
      ' class="form-control input-suggestions-main"',
      ' ng-focus="$ctrl.handleFocus()"',
      ' ng-keyDown="$ctrl.handleKeyDown($event)"',
      ' ng-blur="$ctrl.handleBlur()"',
      ' ng-model="$ctrl.localNgModel"',
      ' ng-model-options="$ctrl.localNgModelOptions"',
      ' ng-model-options="{ debounce: 50 }"',
      ' ng-attr-id="{{ ::$ctrl.inputId }}"',
      ' ng-attr-placeholder="{{ ::$ctrl.inputPlaceholder }}"',
      ' ng-attr-type="{{ ::$ctrl.inputType }}"',
      ' ng-attr-name="{{ ::$ctrl.inputName }}"',
      ' ng-required="::$ctrl.inputRequired">',
      '</div>'
    ].join('')
  })
})
