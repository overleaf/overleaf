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
			scope.contentLimit = 17
			scope.isDeletionCollapsed = true
			scope.isInsertionCollapsed = true
			scope.deletionNeedsCollapsing = false
			scope.insertionNeedsCollapsing = false

			element.on "click", (e) ->
				if $(e.target).is('.rp-entry, .rp-entry-description, .rp-entry-body, .rp-entry-action-icon i')
					scope.onBodyClick()

			scope.toggleDeletionCollapse = () ->
				scope.isDeletionCollapsed = !scope.isDeletionCollapsed
				$timeout () ->
					scope.$emit "review-panel:layout"

			scope.toggleInsertionCollapse = () ->
				scope.isInsertionCollapsed = !scope.isInsertionCollapsed
				$timeout () ->
					scope.$emit "review-panel:layout"

			scope.$watch "entry.metadata.replaced_content.length", (deletionContentLength) ->
					scope.deletionNeedsCollapsing = deletionContentLength > scope.contentLimit

			scope.$watch "entry.content.length", (insertionContentLength) ->
					scope.insertionNeedsCollapsing = insertionContentLength > scope.contentLimit