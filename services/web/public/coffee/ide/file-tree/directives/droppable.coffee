define [
	"base"
], (App) ->
	App.directive "droppable", () ->
		return {
			link: (scope, element, attrs) ->
				scope.$watch attrs.droppable, (droppable) ->
					if droppable
						element.droppable
							greedy: true
							hoverClass: "droppable-hover"
							tolerance: "pointer"
							accept: attrs.accept
							drop: scope.$eval(attrs.onDropCallback)
		}