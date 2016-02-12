define [
	"base"
], (App) ->
	App.directive "draggable", () ->
		return {
			link: (scope, element, attrs) ->
				scope.$watch attrs.draggable, (draggable) ->
					if draggable
						element.draggable
							delay: 250
							opacity: 0.7
							scroll: true
							helper: scope.$eval(attrs.draggableHelper)
		}