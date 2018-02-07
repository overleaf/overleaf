define [
	"base"
	"ide/directives/SafePath"
], (App, SafePath) ->

	MAX_PATH = 1024 # Maximum path length, in characters. This is fairly arbitrary.

	App.directive "validFile", () ->
		return {
			require: 'ngModel'
			link: (scope, element, attrs, ngModelCtrl) ->
				ngModelCtrl.$validators.validFile = (filename) ->
					return SafePath.isCleanFilename filename
		}
