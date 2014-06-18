define [
	"base"
], (App) ->
	App.directive "stopPropagation", ($http) ->
		console.log "Registering"
		return {
			restrict: "A",
			link: (scope, element, attrs) ->
				console.log "linking"
				element.bind attrs.stopPropagation, (e) ->
					console.log "click"
					e.stopPropagation()
		}
