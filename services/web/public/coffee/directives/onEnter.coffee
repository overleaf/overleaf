define [
	"base"
], (App) ->
	App.directive 'onEnter', () ->
		return (scope, element, attrs) ->
			element.bind "keydown keypress", (event) ->
				if event.which == 13
					scope.$apply () ->
						scope.$eval(attrs.onEnter, event: event)
					event.preventDefault()