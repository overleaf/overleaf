define [
	"base"
], (App) ->
	App.directive "droppable", () ->
		return {
			scope: {
				onDropCallback: "="
			}
			link: (scope, element, attrs) ->
				console.log "DROPPABLE", element, scope.onDropCallback
				element.droppable
					greedy: true
					hoverClass: "droppable-hover"
					accept: attrs.accept
					drop: scope.onDropCallback
		}