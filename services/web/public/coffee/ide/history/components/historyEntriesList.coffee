define [
	"base"
], (App) ->
	historyEntriesListController = ($scope, $element, $attrs) ->
		ctrl = @ 
		return

	App.component "historyEntriesList", {
		bindings:
			entries: "<"
			users: "<"
			loadEntries: "&"
			loadDisabled: "<"
			loadInitialize: "<"
			isLoading: "<"
			currentUser: "<"
			onEntrySelect: "&"
			onLabelDelete: "&"
		controller: historyEntriesListController
		templateUrl: "historyEntriesListTpl"
	}
