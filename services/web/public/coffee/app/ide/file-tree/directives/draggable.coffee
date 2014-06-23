define [
	"base"
], (App) ->
	App.directive "draggable", () ->
		return {
			link: (scope, element, attrs) ->
				element.draggable
					delay: 250
					opacity: 0.7
					helper: "clone"
					scroll: true
		}