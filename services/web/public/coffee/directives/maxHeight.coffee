define [
	"base"
], (App) ->
	App.directive "maxHeight", () ->
		return {
			restrict: "A"
			link: (scope, element, attrs) ->
				scope.$watch attrs.maxHeight, (value) ->
					if value?
						element.css("max-height": value)
		}