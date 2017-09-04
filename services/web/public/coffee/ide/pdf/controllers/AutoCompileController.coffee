define [
	"base"
], (App) ->
	App.controller "AutoCompileController", ["$scope", "ide", ($scope, ide) ->
		ide.$scope.$on "ide:opAcknowledged", _.debounce(() ->
			if (!ide.$scope.hasLintingError)
				$scope.recompile()
		, 3000)
	]