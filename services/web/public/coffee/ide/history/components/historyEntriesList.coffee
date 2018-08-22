define [
	"base"
], (App) ->
	historyEntriesListController = ($scope, $element, $attrs) ->
		ctrl = @ 
		ctrl.$entryListViewportEl = null
		_isEntryElVisible = ($entryEl) ->
			entryElTop = $entryEl.offset().top
			entryElBottom = entryElTop + $entryEl.outerHeight()
			entryListViewportElTop = ctrl.$entryListViewportEl.offset().top
			entryListViewportElBottom = entryListViewportElTop + ctrl.$entryListViewportEl.height()
			return entryElTop >= entryListViewportElTop and entryElBottom <= entryListViewportElBottom;
		_getScrollTopPosForEntry = ($entryEl) ->
			halfViewportElHeight = ctrl.$entryListViewportEl.height() / 2
			return $entryEl.offset().top - halfViewportElHeight
		ctrl.onEntryLinked = (entry, $entryEl) ->
			if entry.selectedTo and entry.selectedFrom and !_isEntryElVisible $entryEl
				$scope.$applyAsync () ->
					ctrl.$entryListViewportEl.scrollTop _getScrollTopPosForEntry $entryEl
		ctrl.$onInit = () ->
			ctrl.$entryListViewportEl = $element.find "> .history-entries"
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
