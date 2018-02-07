define [
	"base"
	"ide/directives/SafePath"
], (App, SafePath) ->

	App.directive "validFile", () ->
		return {
			require: 'ngModel'
			link: (scope, element, attrs, ngModelCtrl) ->
				ngModelCtrl.$validators.validFile = (filename) ->
					return SafePath.isCleanFilename filename
		}
