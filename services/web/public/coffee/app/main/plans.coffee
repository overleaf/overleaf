define [
	"base"
], (App) ->
	App.controller "PlansController", ($scope) ->
		$scope.ui =
			view: "monthly"