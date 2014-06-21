define [
	"base"
], (App) ->
	App.directive "fileEntity", ["RecursionHelper", (RecursionHelper) ->
		return {
			restrict: "E"
			scope: {
				entity: "="
			}
			templateUrl: "entityListItemTemplate"
			compile: (element) ->
				RecursionHelper.compile element, (scope, element, attrs, ctrl) ->
					# Link function here if needed
		}
	]