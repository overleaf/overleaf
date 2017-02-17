define [
	"base"
], (App) ->
	App.directive "reviewPanelCollapseHeight", ($parse) ->
		return {
			restrict: "A",
			link: (scope, element, attrs) ->
				scope.$watch (() -> $parse(attrs.reviewPanelCollapseHeight)(scope)), (shouldCollapse) ->
					neededHeight = element.prop("scrollHeight")
					if neededHeight > 0
						if shouldCollapse
							element.animate { height: 0 }, 150
						else
							element.animate { height: neededHeight }, 150
		}