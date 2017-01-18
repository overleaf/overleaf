define [
	"base"
], (App) ->
	App.directive "resolvedCommentEntry", () ->
		restrict: "E"
		templateUrl: "resolvedCommentEntryTemplate"
		scope:
			thread: "="
			permissions: "="
			onUnresolve: "&"
			onDelete: "&"
		link: (scope, element, attrs) ->
			scope.contentLimit = 40
			scope.needsCollapsing = false
			scope.isCollapsed = true

			scope.toggleCollapse = () ->
				scope.isCollapsed = !scope.isCollapsed
				$timeout () ->
					scope.$emit "review-panel:layout"

			scope.$watch "thread.content.length", (contentLength) ->
				scope.needsCollapsing = contentLength > scope.contentLimit