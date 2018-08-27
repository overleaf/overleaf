define [
	"base"
], (App) ->
	historyLabelController = ($scope, $element, $attrs, $filter, _) ->
		ctrl = @
		ctrl.$onInit = () ->
			ctrl.showTooltip ?= true
		return

	App.component "historyLabel", {
		bindings:
			labelText: "<"
			labelOwnerName: "<?"
			labelCreationDateTime: "<?"
			isOwnedByCurrentUser: "<"
			onLabelDelete: "&"
			showTooltip: "<?"
		controller: historyLabelController
		templateUrl: "historyLabelTpl"
	}