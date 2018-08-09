define [
	"base"
], (App) ->
	historyLabelController = ($scope, $element, $attrs, $filter, _) ->
		ctrl = @
		return

	App.component "historyLabel", {
		bindings:
			labelText: "<"
			labelOwnerName: "<"
			labelCreationDateTime: "<"
			isOwnedByCurrentUser: "<"
			onLabelDelete: "&"
		controller: historyLabelController
		templateUrl: "historyLabelTpl"
	}