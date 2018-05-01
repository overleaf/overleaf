define [
	"base"
	"ide/history/util/displayNameForUser"
], (App, displayNameForUser) ->
	historyEntryController = ($scope, $element, $attrs) ->
		ctrl = @
		ctrl.displayName = displayNameForUser
		ctrl.getProjectOpAction = (projectOp) ->
			if projectOp.rename? then "Renamed"
			else if projectOp.add? then "Created"
			else if projectOp.remove? then "Deleted"
		ctrl.getProjectOpDoc = (projectOp) ->
			if projectOp.rename? then "#{ projectOp.rename.pathname} → #{ projectOp.rename.newPathname }"
			else if projectOp.add? then "#{ projectOp.add.pathname}"
			else if projectOp.remove? then "#{ projectOp.remove.pathname}"
		return

	App.component "historyEntry", {
		bindings:
			entry: "<"
			currentUser: "<"
			onSelect: "&"
		controller: historyEntryController
		templateUrl: "historyEntryTpl"
	}