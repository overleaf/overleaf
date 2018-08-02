define [
	"base"
], (App) ->
	historyEntriesListController = ($scope, $element, $attrs) ->
		ctrl = @ 
		ctrl.shouldShowEntry = (entry) ->
			!(ctrl.showOnlyLabelled and entry.labels.length == 0) 
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
			showOnlyLabelled: "<"
		controller: historyEntriesListController
		templateUrl: "historyEntriesListTpl"
	}
