define [
	"base"
], (App) ->
	App.directive "focusInput", ($timeout) ->
		return (scope, element, attr) ->
			scope.$watch attr.focusInput, (value) ->
				if value
					$timeout ->
						element.select()