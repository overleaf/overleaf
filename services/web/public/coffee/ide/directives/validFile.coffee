define [
	"base"
], (App) ->
	App.directive "validFile", () ->
		return {
			require: 'ngModel'
			link: (scope, element, attrs, ngModelCtrl) ->
				ngModelCtrl.$validators.validFile = (modelValue) ->
					validFileRegex = /^[^\*\/]*$/ # Don't allow * and /
					isValid = modelValue.match validFileRegex
					return isValid
		}
