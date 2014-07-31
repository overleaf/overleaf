define [
	"base"
], (App) ->
	App.directive "rightClick", () ->
		return {
			restrict: "A",
			link: (scope, element, attrs) ->
				element.bind "contextmenu", (e) ->
					e.preventDefault()
					e.stopPropagation()
					scope.$eval(attrs.rightClick)
		}
