/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], function(App) {
  const historyEntriesListController = function($scope, $element, $attrs) {
    const ctrl = this
    ctrl.$entryListViewportEl = null
    const _isEntryElVisible = function($entryEl) {
      const entryElTop = $entryEl.offset().top
      const entryElBottom = entryElTop + $entryEl.outerHeight()
      const entryListViewportElTop = ctrl.$entryListViewportEl.offset().top
      const entryListViewportElBottom =
        entryListViewportElTop + ctrl.$entryListViewportEl.height()
      return (
        entryElTop >= entryListViewportElTop &&
        entryElBottom <= entryListViewportElBottom
      )
    }
    const _getScrollTopPosForEntry = function($entryEl) {
      const halfViewportElHeight = ctrl.$entryListViewportEl.height() / 2
      return $entryEl.offset().top - halfViewportElHeight
    }
    ctrl.onEntryLinked = function(entry, $entryEl) {
      if (
        entry.selectedTo &&
        entry.selectedFrom &&
        !_isEntryElVisible($entryEl)
      ) {
        return $scope.$applyAsync(() =>
          ctrl.$entryListViewportEl.scrollTop(
            _getScrollTopPosForEntry($entryEl)
          )
        )
      }
    }
    ctrl.$onInit = () =>
      (ctrl.$entryListViewportEl = $element.find('> .history-entries'))
  }

  return App.component('historyEntriesList', {
    bindings: {
      entries: '<',
      users: '<',
      loadEntries: '&',
      loadDisabled: '<',
      loadInitialize: '<',
      isLoading: '<',
      currentUser: '<',
      freeHistoryLimitHit: '<',
      currentUserIsOwner: '<',
      onEntrySelect: '&',
      onLabelDelete: '&'
    },
    controller: historyEntriesListController,
    templateUrl: 'historyEntriesListTpl'
  })
})
