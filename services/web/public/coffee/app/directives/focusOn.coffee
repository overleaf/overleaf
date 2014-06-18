define [
	"base"
], (App) ->
	App.directive 'focusOn', ($timeout) ->
		return {
			restrict: 'AC'
			link: (scope, element, attrs) ->
				scope.$on attrs.focusOn, () ->
					element.focus()
		}