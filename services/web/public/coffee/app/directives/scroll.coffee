define [
	"base"
], (App) ->
	App.directive 'scrollToBottomOn', () ->
		return {
			link: (scope, element, attrs) ->
				element = element[0]
				eventToScrollOn = attrs.scrollToBottomOn
				console.log eventToScrollOn
				scope.$on eventToScrollOn, ()->
					console.log element.scrollHeight, element.scrollTop
					element.scrollTop = element.scrollHeight*4
					console.log element.scrollHeight, element.scrollTop
		}
