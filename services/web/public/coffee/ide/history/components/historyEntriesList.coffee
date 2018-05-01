define [
	"base"
], (App) ->
	historyEntriesListController = ($scope, $element, $attrs) ->
		ctrl = @ 
		return

	App.component "historyEntriesList", {
		bindings:
			entries: "<"
			loadEntries: "&"
			loadDisabled: "<"
			loadInitialize: "<"
			isLoading: "<"
			currentUser: "<"
			onEntrySelect: "&"
		controller: historyEntriesListController
		templateUrl: "historyEntriesListTpl"
	}
