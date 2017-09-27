define [
	"base"
], (App) ->
	App.controller "AutoCompileOnboardingController", ($scope) ->
		unsub = $scope.$on "pdf.recompile", () ->
			console.log('recompiling')
			unsub()