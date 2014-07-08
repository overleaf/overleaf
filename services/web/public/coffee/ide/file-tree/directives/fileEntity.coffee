define [
	"base"
], (App) ->
	App.directive "fileEntity", ["RecursionHelper", (RecursionHelper) ->
		return {
			restrict: "E"
			scope: {
				entity: "="
				permissions: "="
			}
			templateUrl: "entityListItemTemplate"
			compile: (element) ->
				RecursionHelper.compile element, (scope, element, attrs, ctrl) ->
					# Don't freak out if we're already in an apply callback
					scope.$originalApply = scope.$apply
					scope.$apply = (fn = () ->) ->
						phase = @$root.$$phase
						if (phase == '$apply' || phase == '$digest')
							fn()
						else
							@$originalApply(fn);
		}
	]