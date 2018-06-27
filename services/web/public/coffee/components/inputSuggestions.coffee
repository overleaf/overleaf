define [
	"base"
], (App) ->
	inputSuggestionsController = ($scope, $element, $attrs, Keys) ->
		ctrl = @ 
		ctrl.showHint = false
		ctrl.hasFocus = false
		ctrl.handleFocus = () ->
			ctrl.hasFocus = true
			ctrl.suggestion = null
		ctrl.handleBlur = () ->
			ctrl.showHint = false
			ctrl.hasFocus = false
			ctrl.suggestion = null
			ctrl.onBlur()
		ctrl.handleKeyDown = ($event) ->
			if ($event.which == Keys.TAB or $event.which == Keys.ENTER) and ctrl.suggestion? and ctrl.suggestion != ""
				$event.preventDefault()
				ctrl.localNgModel += ctrl.suggestion
			ctrl.suggestion = null
			ctrl.showHint = false
		$scope.$watch "$ctrl.localNgModel", (newVal, oldVal) ->
			if ctrl.hasFocus and newVal != oldVal
				ctrl.suggestion = null
				ctrl.showHint = false
				ctrl.getSuggestion({ userInput: newVal })
					.then (suggestion) -> 
						if suggestion? and newVal == ctrl.localNgModel
							ctrl.showHint = true
							ctrl.suggestion = suggestion.replace newVal, ""
					.catch () -> ctrl.suggestion = null
		return

	App.component "inputSuggestions", {
		bindings:
			localNgModel: "=ngModel"
			localNgModelOptions: "=?ngModelOptions"
			getSuggestion: "&"
			onBlur: "&?"
			inputId: "@?"
			inputName: "@?"
			inputPlaceholder: "@?"
			inputType: "@?"
			inputRequired: "=?"
		controller: inputSuggestionsController
		template: """
			<div class="input-suggestions">
				<div class="form-control input-suggestions-shadow">
					<span ng-bind="$ctrl.localNgModel" class="input-suggestions-shadow-existing" ng-show="$ctrl.showHint"></span><span ng-bind="$ctrl.suggestion" class="input-suggestions-shadow-suggested" ng-show="$ctrl.showHint"></span>
				</div>
				<input type="text" ng-focus="$ctrl.handleFocus()" ng-keyDown="$ctrl.handleKeyDown($event)" ng-blur="$ctrl.handleBlur()" ng-model="$ctrl.localNgModel" ng-model-options="$ctrl.localNgModelOptions" ng-model-options="{ debounce: 50 }" class="form-control input-suggestions-main" ng-attr-id="{{ ::$ctrl.inputId }}" ng-attr-placeholder="{{ ::$ctrl.inputPlaceholder }}" ng-attr-type="{{ ::$ctrl.inputType }}" ng-attr-name="{{ ::$ctrl.inputName }}" ng-required="::$ctrl.inputRequired">
			</div>
			"""
	}
