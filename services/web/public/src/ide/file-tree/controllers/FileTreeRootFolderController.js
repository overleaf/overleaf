/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('FileTreeRootFolderController', function($scope, ide) {
    const { rootFolder } = $scope
    return ($scope.onDrop = function(events, ui) {
      let entities
      if (ide.fileTreeManager.multiSelectedCount()) {
        entities = ide.fileTreeManager.getMultiSelectedEntityChildNodes()
      } else {
        entities = [$(ui.draggable).scope().entity]
      }
      for (let dropped_entity of Array.from(entities)) {
        ide.fileTreeManager.moveEntity(dropped_entity, rootFolder)
      }
      $scope.$digest()
      // clear highlight explicitly
      return $('.file-tree-inner .droppable-hover').removeClass(
        'droppable-hover'
      )
    })
  }))
