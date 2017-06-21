define [
	"base"
], (App) ->
	App.directive "selectAllList", () ->
		return {
			controller: ["$scope", ($scope) ->
				# Selecting or deselecting all should apply to all projects
				@selectAll = () ->
					$scope.$broadcast "select-all:select"

				@deselectAll = () ->
					$scope.$broadcast "select-all:deselect"

				@clearSelectAllState = () ->
					$scope.$broadcast "select-all:clear"
				return
			]
			link: (scope, element, attrs) ->


		}

	App.directive "selectAll", () ->
		return {
			require: "^selectAllList"
			link: (scope, element, attrs, selectAllListController) ->
				scope.$on "select-all:clear", () ->
					element.prop("checked", false)

				element.change () ->
					if element.is(":checked")
						selectAllListController.selectAll()
					else
						selectAllListController.deselectAll()
					return true
		}

	App.directive "selectIndividual", () ->
		return {
			require: "^selectAllList"
			scope: {
				ngModel: "="
			}
			link: (scope, element, attrs, selectAllListController) ->
				ignoreChanges = false

				scope.$watch "ngModel", (value) ->
					if value? and !ignoreChanges
						selectAllListController.clearSelectAllState()

				scope.$on "select-all:select", () ->
					ignoreChanges = true
					scope.$apply () ->
						scope.ngModel = true
					ignoreChanges = false

				scope.$on "select-all:deselect", () ->
					ignoreChanges = true
					scope.$apply () ->
						scope.ngModel = false
					ignoreChanges = false

				scope.$on "select-all:row-clicked", () ->
					ignoreChanges = true
					scope.$apply () ->
						scope.ngModel = !scope.ngModel
						if !scope.ngModel
							selectAllListController.clearSelectAllState()
					ignoreChanges = false
		}

	App.directive "selectRow", () ->
		return {
			scope: true
			link: (scope, element, attrs) ->
				element.on "click", (e) ->
					scope.$broadcast "select-all:row-clicked"
		}