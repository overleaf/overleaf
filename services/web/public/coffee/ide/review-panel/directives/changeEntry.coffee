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
			scope.isCollapsed = true
			scope.needsCollapsing = false

			scope.toggleCollapse = () ->
				scope.isCollapsed = !scope.isCollapsed
				$timeout () ->
					scope.$emit "review-panel:layout"

			scope.$watch "entry.content.length", (contentLength) ->
				scope.needsCollapsing = contentLength > scope.contentLimit