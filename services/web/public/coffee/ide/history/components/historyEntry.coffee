define [
	"base"
	"ide/history/util/displayNameForUser"
], (App, displayNameForUser) ->
	historyEntryController = ($scope, $element, $attrs) ->
		ctrl = @
		ctrl.displayName = displayNameForUser
		return

	App.component "historyEntry", {
		bindings:
			entry: "<"
		controller: historyEntryController
		templateUrl: "historyEntryTpl"
	}