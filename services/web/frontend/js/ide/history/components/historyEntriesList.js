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
  const historyEntriesListController = function($scope, $element, $attrs, _) {
    const ctrl = this
    ctrl.$entryListViewportEl = null
    ctrl.isDragging = false

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
        !ctrl.rangeSelectionEnabled &&
        entry.toV === ctrl.selectedHistoryVersion
      ) {
        $scope.$applyAsync(() => {
          if (!_isEntryElVisible($entryEl)) {
            ctrl.$entryListViewportEl.scrollTop(
              _getScrollTopPosForEntry($entryEl)
            )
          }
        })
      }
    }
    ctrl.handleEntrySelect = entry => {
      if (ctrl.rangeSelectionEnabled) {
        ctrl.onRangeSelect({
          selectedToV: entry.toV,
          selectedFromV: entry.fromV
        })
      } else {
        ctrl.onVersionSelect({ version: entry.toV })
      }
    }
    ctrl.setRangeToV = toV => {
      if (toV > ctrl.selectedHistoryRange.fromV) {
        ctrl.onRangeSelect({
          selectedToV: toV,
          selectedFromV: ctrl.selectedHistoryRange.fromV
        })
      }
    }
    ctrl.setRangeFromV = fromV => {
      if (fromV < ctrl.selectedHistoryRange.toV) {
        ctrl.onRangeSelect({
          selectedToV: ctrl.selectedHistoryRange.toV,
          selectedFromV: fromV
        })
      }
    }
    ctrl.initHoveredRange = () => {
      ctrl.hoveredHistoryRange = {
        toV: ctrl.selectedHistoryRange.toV,
        fromV: ctrl.selectedHistoryRange.fromV
      }
    }
    ctrl.resetHoveredRange = () => {
      ctrl.hoveredHistoryRange = { toV: null, fromV: null }
    }
    ctrl.setHoveredRangeToV = toV => {
      if (toV > ctrl.hoveredHistoryRange.fromV) {
        $scope.$applyAsync(() => (ctrl.hoveredHistoryRange.toV = toV))
      }
    }
    ctrl.setHoveredRangeFromV = fromV => {
      if (fromV < ctrl.hoveredHistoryRange.toV) {
        $scope.$applyAsync(() => (ctrl.hoveredHistoryRange.fromV = fromV))
      }
    }
    ctrl.onDraggingStart = () => {
      $scope.$applyAsync(() => {
        ctrl.isDragging = true
        ctrl.initHoveredRange()
      })
    }
    ctrl.onDraggingStop = (isValidDrop, boundary) => {
      $scope.$applyAsync(() => {
        ctrl.isDragging = false
        if (!isValidDrop) {
          if (boundary === 'toV') {
            ctrl.setRangeToV(ctrl.hoveredHistoryRange.toV)
          } else if (boundary === 'fromV') {
            ctrl.setRangeFromV(ctrl.hoveredHistoryRange.fromV)
          }
        }
        ctrl.resetHoveredRange()
      })
    }
    ctrl.$onInit = () => {
      ctrl.$entryListViewportEl = $element.find('> .history-entries')
      ctrl.resetHoveredRange()
    }
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
      rangeSelectionEnabled: '<',
      selectedHistoryVersion: '<?',
      selectedHistoryRange: '<?',
      onVersionSelect: '&',
      onRangeSelect: '&',
      onLabelDelete: '&'
    },
    controller: historyEntriesListController,
    templateUrl: 'historyEntriesListTpl'
  })
})
