define [
	"base"
], (App) ->

	App.directive 'equals', () ->
		return {
			require: "ngModel",
			link: (scope, element, attrs, ngModel) ->
				scope.$watch attrs.ngModel, () -> validate()
				attrs.$observe 'equals', () -> validate()

				validate = () ->
					equal = (attrs.equals == ngModel.$viewValue)
					ngModel.$setValidity('areEqual', equal)
		}
