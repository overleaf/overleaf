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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('FileTreeFolderController', function(
    $scope,
    ide,
    $modal,
    localStorage
  ) {
    $scope.expanded =
      localStorage(`folder.${$scope.entity.id}.expanded`) || false

    $scope.toggleExpanded = function() {
      $scope.expanded = !$scope.expanded
      return localStorage(
        `folder.${$scope.entity.id}.expanded`,
        $scope.expanded
      )
    }

    $scope.onDrop = function(events, ui) {
      let entities
      if (ide.fileTreeManager.multiSelectedCount()) {
        entities = ide.fileTreeManager.getMultiSelectedEntityChildNodes()
      } else {
        entities = [$(ui.draggable).scope().entity]
      }
      for (let dropped_entity of Array.from(entities)) {
        ide.fileTreeManager.moveEntity(dropped_entity, $scope.entity)
      }
      $scope.$digest()
      // clear highlight explicitly
      return $('.file-tree-inner .droppable-hover').removeClass(
        'droppable-hover'
      )
    }

    $scope.orderByFoldersFirst = function(entity) {
      // We need this here as well as in FileTreeController
      // since the file-entity diretive creates a new scope
      // that doesn't inherit from previous scopes.
      if ((entity != null ? entity.type : undefined) === 'folder') {
        return '0'
      }
      return '1'
    }

    $scope.openNewDocModal = () =>
      $modal.open({
        templateUrl: 'newFileModalTemplate',
        controller: 'NewFileModalController',
        size: 'lg',
        resolve: {
          parent_folder() {
            return $scope.entity
          },
          projectFeatures() {
            return ide.$scope.project.features
          },
          type() {
            return 'doc'
          },
          userFeatures() {
            return ide.$scope.user.features
          }
        }
      })

    $scope.openNewFolderModal = () =>
      $modal.open({
        templateUrl: 'newFolderModalTemplate',
        controller: 'NewFolderModalController',
        resolve: {
          parent_folder() {
            return $scope.entity
          }
        }
      })

    return ($scope.openUploadFileModal = () =>
      $modal.open({
        templateUrl: 'newFileModalTemplate',
        controller: 'NewFileModalController',
        size: 'lg',
        resolve: {
          parent_folder() {
            return $scope.entity
          },
          projectFeatures() {
            return ide.$scope.project.features
          },
          type() {
            return 'upload'
          },
          userFeatures() {
            return ide.$scope.user.features
          }
        }
      }))
  }))
