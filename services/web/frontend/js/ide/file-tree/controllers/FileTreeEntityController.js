/* eslint-disable
    chai-friendly/no-unused-expressions,
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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'ide/file-tree/util/iconTypeFromName'], function(
  App,
  iconTypeFromName
) {
  App.controller('FileTreeEntityController', function($scope, ide, $modal) {
    $scope.select = function(e) {
      if (e.ctrlKey || e.metaKey) {
        e.stopPropagation()
        const initialMultiSelectCount = ide.fileTreeManager.multiSelectedCount()
        ide.fileTreeManager.toggleMultiSelectEntity($scope.entity) === 0
        if (initialMultiSelectCount === 0) {
          // On first multi selection, also include the current active/open file.
          return ide.fileTreeManager.multiSelectSelectedEntity()
        }
      } else {
        ide.fileTreeManager.selectEntity($scope.entity)
        return $scope.$emit('entity:selected', $scope.entity)
      }
    }

    $scope.draggableHelper = function() {
      if (ide.fileTreeManager.multiSelectedCount() > 0) {
        return $(
          `<strong style='z-index:100'>${ide.fileTreeManager.multiSelectedCount()} Files</strong>`
        )
      } else {
        return $(`<strong style='z-index:100'>${$scope.entity.name}</strong>`)
      }
    }

    $scope.inputs = { name: $scope.entity.name }

    $scope.startRenaming = () => ($scope.entity.renaming = true)

    let invalidModalShowing = false
    $scope.finishRenaming = function() {
      // avoid double events when blur and on-enter fire together
      if (!$scope.entity.renaming) {
        return
      }

      const { name } = $scope.inputs

      // validator will set name to undefined for invalid filenames
      if (name == null) {
        // Showing the modal blurs the rename box which calls us again
        // so track this with the invalidModalShowing flag
        if (invalidModalShowing) {
          return
        }
        invalidModalShowing = true
        const modal = $modal.open({
          templateUrl: 'invalidFileNameModalTemplate'
        })
        modal.result.then(() => (invalidModalShowing = false))
        return
      }

      delete $scope.entity.renaming
      if (name == null || name.length === 0) {
        $scope.inputs.name = $scope.entity.name
        return
      }
      return ide.fileTreeManager.renameEntity($scope.entity, name)
    }

    $scope.$on('rename:selected', function() {
      if ($scope.entity.selected) {
        return $scope.startRenaming()
      }
    })

    $scope.openDeleteModal = function() {
      let entities
      if (ide.fileTreeManager.multiSelectedCount() > 0) {
        entities = ide.fileTreeManager.getMultiSelectedEntityChildNodes()
      } else {
        entities = [$scope.entity]
      }
      return $modal.open({
        templateUrl: 'deleteEntityModalTemplate',
        controller: 'DeleteEntityModalController',
        resolve: {
          entities() {
            return entities
          }
        }
      })
    }

    $scope.$on('delete:selected', function() {
      if ($scope.entity.selected) {
        return $scope.openDeleteModal()
      }
    })

    return ($scope.iconTypeFromName = iconTypeFromName)
  })

  return App.controller('DeleteEntityModalController', function(
    $scope,
    ide,
    $modalInstance,
    entities
  ) {
    $scope.state = { inflight: false }

    $scope.entities = entities

    $scope.delete = function() {
      $scope.state.inflight = true
      for (let entity of Array.from($scope.entities)) {
        ide.fileTreeManager.deleteEntity(entity)
      }
      return $modalInstance.close()
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  })
})
