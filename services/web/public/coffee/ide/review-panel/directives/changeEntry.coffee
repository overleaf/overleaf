define [
	"base"
], (App) ->
	App.directive "changeEntry", ($timeout) ->
		restrict: "E"
		templateUrl: "changeEntryTemplate"
		scope: 
			entry: "="
			user: "="
			permissions: "="
			onAccept: "&"
			onReject: "&"
			onIndicatorClick: "&"
		link: (scope, element, attrs) ->
			scope.contentLimit = 40
			scope.needsCollapsing = scope.entry.content.length > scope.contentLimit
			scope.isCollapsed = true

			scope.toggleCollapse = () ->
				scope.isCollapsed = !scope.isCollapsed
				$timeout () ->
					scope.$emit "review-panel:layout"