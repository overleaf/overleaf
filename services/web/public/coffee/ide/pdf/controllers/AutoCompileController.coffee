define [
	"base"
], (App) ->
	App.controller "AutoCompileController", ["$scope", "ide", ($scope, ide) ->
		hasLintingError = false

		ide.$scope.$on "ide:opAcknowledged", _.debounce(() ->
			if (!hasLintingError)
				$scope.recompile()
		, 3000)

		ide.$scope.$on "ide:lintingError", (e, hasError) ->
			hasLintingError = hasError
	]