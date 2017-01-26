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
			onBodyClick: "&"
		link: (scope, element, attrs) ->
			scope.contentLimit = 40
			scope.isCollapsed = true
			scope.needsCollapsing = false

			element.on "click", (e) ->
				if $(e.target).is('.rp-entry, .rp-entry-description, .rp-entry-body')
					scope.onBodyClick()

			scope.toggleCollapse = () ->
				scope.isCollapsed = !scope.isCollapsed
				$timeout () ->
					scope.$emit "review-panel:layout"

			scope.$watch "entry.content.length", (contentLength) ->
				scope.needsCollapsing = contentLength > scope.contentLimit