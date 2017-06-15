define [
	"base"
], (App) ->
	App.directive "aggregateChangeEntry", ($timeout) ->
		restrict: "E"
		templateUrl: "aggregateChangeEntryTemplate"
		scope: 
			entry: "="
			user: "="
			permissions: "="
			onAccept: "&"
			onReject: "&"
			onIndicatorClick: "&"
			onBodyClick: "&"
		link: (scope, element, attrs) ->
			scope.contentLimit = 35
			scope.isCollapsed = true
			scope.needsCollapsing = false

			element.on "click", (e) ->
				if $(e.target).is('.rp-entry, .rp-entry-description, .rp-entry-body, .rp-entry-action-icon i')
					scope.onBodyClick()

			scope.toggleCollapse = () ->
				scope.isCollapsed = !scope.isCollapsed
				$timeout () ->
					scope.$emit "review-panel:layout"

			scope.$watch "entry.content.length + entry.metadata.agg_op.content.length", (contentLength) ->
					scope.needsCollapsing = contentLength > scope.contentLimit