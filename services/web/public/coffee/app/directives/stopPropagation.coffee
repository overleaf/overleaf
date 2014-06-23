define [
	"base"
], (App) ->
	App.directive "stopPropagation", ($http) ->
		return {
			restrict: "A",
			link: (scope, element, attrs) ->
				element.bind attrs.stopPropagation, (e) ->
					e.stopPropagation()
		}

	App.directive "preventDefault", ($http) ->
		return {
			restrict: "A",
			link: (scope, element, attrs) ->
				element.bind attrs.preventDefault, (e) ->
					e.preventDefault()
		}
