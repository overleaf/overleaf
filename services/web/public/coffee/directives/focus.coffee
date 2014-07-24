define [
	"base"
], (App) ->
	App.directive "focusWhen", ($timeout) ->
		return {
			restrict: "A"
			link: (scope, element, attr) ->
				scope.$watch attr.focusWhen, (value) ->
					if value
						$timeout ->
							element.focus()
		}

	App.directive 'focusOn', ($timeout) ->
		return {
			restrict: 'A'
			link: (scope, element, attrs) ->
				scope.$on attrs.focusOn, () ->
					element.focus()
		}

	App.directive "selectWhen", ($timeout) ->
		return {
			restrict: "A"
			link: (scope, element, attr) ->
				scope.$watch attr.selectWhen, (value) ->
					if value
						$timeout ->
							element.select()
		}

	App.directive 'selectOn', ($timeout) ->
		return {
			restrict: 'A'
			link: (scope, element, attrs) ->
				scope.$on attrs.selectOn, () ->
					element.select()
		}

	App.directive "selectNameWhen", ($timeout) ->
		return {
			restrict: 'A'
			link: (scope, element, attrs) ->
				scope.$watch attrs.selectNameWhen, (value) ->
					if value
						$timeout () ->
							selectName(element)
		}

	App.directive "selectNameOn", () ->
		return {
			restrict: 'A'
			link: (scope, element, attrs) ->
				scope.$on attrs.selectNameOn, () ->
					selectName(element)
		}


	App.directive "focus", ($timeout) ->
		scope:
			trigger: "@focus"

		link: (scope, element) ->
			scope.$watch "trigger", (value) ->
				if value is "true"
					$timeout ->
						element[0].focus()

	selectName = (element) ->
		# Select up to last '.'. I.e. everything
		# except the file extension
		element.focus()
		name = element.val()
		if element[0].setSelectionRange?
			selectionEnd = name.lastIndexOf(".")
			if selectionEnd == -1
				selectionEnd = name.length
			element[0].setSelectionRange(0, selectionEnd)
