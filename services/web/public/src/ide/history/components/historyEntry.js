/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'base',
  'ide/colors/ColorManager',
  'ide/history/util/displayNameForUser'
], function(App, ColorManager, displayNameForUser) {
  const historyEntryController = function($scope, $element, $attrs, _) {
    const ctrl = this
    // This method (and maybe the one below) will be removed soon. User details data will be
    // injected into the history API responses, so we won't need to fetch user data from other
    // local data structures.
    const _getUserById = id =>
      _.find(ctrl.users, function(user) {
        const curUserId =
          (user != null ? user._id : undefined) ||
          (user != null ? user.id : undefined)
        return curUserId === id
      })
    ctrl.displayName = displayNameForUser
    ctrl.displayNameById = id => displayNameForUser(_getUserById(id))
    ctrl.getProjectOpDoc = function(projectOp) {
      if (projectOp.rename != null) {
        return `${projectOp.rename.pathname} → ${projectOp.rename.newPathname}`
      } else if (projectOp.add != null) {
        return `${projectOp.add.pathname}`
      } else if (projectOp.remove != null) {
        return `${projectOp.remove.pathname}`
      }
    }
    ctrl.getUserCSSStyle = function(user) {
      const curUserId =
        (user != null ? user._id : undefined) ||
        (user != null ? user.id : undefined)
      const hue = ColorManager.getHueForUserId(curUserId) || 100
      if (ctrl.isEntrySelected() || ctrl.isEntryHoverSelected()) {
        return { color: '#FFF' }
      } else {
        return { color: `hsl(${hue}, 70%, 50%)` }
      }
    }
    ctrl.isEntrySelected = function() {
      if (ctrl.rangeSelectionEnabled) {
        return (
          ctrl.entry.toV <= ctrl.selectedHistoryRange.toV &&
          ctrl.entry.fromV >= ctrl.selectedHistoryRange.fromV
        )
      } else {
        return ctrl.entry.toV === ctrl.selectedHistoryVersion
      }
    }

    ctrl.isEntryHoverSelected = function() {
      return (
        ctrl.rangeSelectionEnabled &&
        ctrl.entry.toV <= ctrl.hoveredHistoryRange.toV &&
        ctrl.entry.fromV >= ctrl.hoveredHistoryRange.fromV
      )
    }

    ctrl.onDraggingStart = () => {
      ctrl.historyEntriesList.onDraggingStart()
    }
    ctrl.onDraggingStop = (isValidDrop, boundary) =>
      ctrl.historyEntriesList.onDraggingStop(isValidDrop, boundary)

    ctrl.onDrop = boundary => {
      if (boundary === 'toV') {
        $scope.$applyAsync(() =>
          ctrl.historyEntriesList.setRangeToV(ctrl.entry.toV)
        )
      } else if (boundary === 'fromV') {
        $scope.$applyAsync(() =>
          ctrl.historyEntriesList.setRangeFromV(ctrl.entry.fromV)
        )
      }
    }
    ctrl.onOver = boundary => {
      if (boundary === 'toV') {
        $scope.$applyAsync(() =>
          ctrl.historyEntriesList.setHoveredRangeToV(ctrl.entry.toV)
        )
      } else if (boundary === 'fromV') {
        $scope.$applyAsync(() =>
          ctrl.historyEntriesList.setHoveredRangeFromV(ctrl.entry.fromV)
        )
      }
    }

    ctrl.$onInit = () => {
      ctrl.$entryEl = $element.find('> .history-entry')
      ctrl.$entryDetailsEl = $element.find('.history-entry-details')
      ctrl.$toVHandleEl = $element.find('.history-entry-toV-handle')
      ctrl.$fromVHandleEl = $element.find('.history-entry-fromV-handle')
      ctrl.historyEntriesList.onEntryLinked(ctrl.entry, ctrl.$entryEl)
    }
  }

  return App.component('historyEntry', {
    bindings: {
      entry: '<',
      currentUser: '<',
      users: '<',
      rangeSelectionEnabled: '<',
      isDragging: '<',
      selectedHistoryVersion: '<?',
      selectedHistoryRange: '<?',
      hoveredHistoryRange: '<?',
      onSelect: '&',
      onLabelDelete: '&'
    },
    require: {
      historyEntriesList: '^historyEntriesList'
    },
    controller: historyEntryController,
    templateUrl: 'historyEntryTpl'
  })
})
