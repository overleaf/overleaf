define [
	"base"
], (App) ->

	App.directive "equals", [->
		return {
			require: "ngModel"
			link: (scope, elem, attrs, ctrl) ->
				firstField = "#" + attrs.equals
				elem.add(firstField).on "keyup", ->
					scope.$apply ->
						equal = elem.val() == $(firstField).val()
						ctrl.$setValidity "areEqual", equal
		}
	]