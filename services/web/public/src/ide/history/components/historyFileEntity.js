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
define(['base', 'ide/file-tree/util/iconTypeFromName'], function(
  App,
  iconTypeFromName
) {
  // TODO Add arrows in folders
  const historyFileEntityController = function($scope, $element, $attrs) {
    const ctrl = this
    const _handleFolderClick = function() {
      ctrl.isOpen = !ctrl.isOpen
      return (ctrl.iconClass = _getFolderIcon())
    }
    const _handleFileClick = () =>
      ctrl.historyFileTreeController.handleEntityClick(ctrl.fileEntity)
    var _getFolderIcon = function() {
      if (ctrl.isOpen) {
        return 'fa-folder-open'
      } else {
        return 'fa-folder'
      }
    }
    ctrl.$onInit = function() {
      if (ctrl.fileEntity.type === 'folder') {
        ctrl.isOpen = true
        ctrl.iconClass = _getFolderIcon()
        return (ctrl.handleClick = _handleFolderClick)
      } else {
        ctrl.iconClass = `fa-${iconTypeFromName(ctrl.fileEntity.name)}`
        ctrl.handleClick = _handleFileClick
        return $scope.$watch(
          () => ctrl.historyFileTreeController.selectedPathname,
          newPathname =>
            (ctrl.isSelected = ctrl.fileEntity.pathname === newPathname)
        )
      }
    }
  }

  return App.component('historyFileEntity', {
    require: {
      historyFileTreeController: '^historyFileTree'
    },
    bindings: {
      fileEntity: '<'
    },
    controller: historyFileEntityController,
    templateUrl: 'historyFileEntityTpl'
  })
})
