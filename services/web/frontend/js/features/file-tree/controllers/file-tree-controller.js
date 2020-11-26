import App from '../../../base'
import { react2angular } from 'react2angular'

import FileTreeRoot from '../components/file-tree-root'

App.controller('ReactFileTreeController', function(
  $scope,
  $timeout,
  ide,
  eventTracking
) {
  $scope.projectId = ide.project_id
  $scope.rootFolder = null
  $scope.rootDocId = null
  $scope.hasWritePermissions = false

  $scope.$on('project:joined', () => {
    $scope.rootFolder = $scope.project.rootFolder
    $scope.rootDocId = $scope.project.rootDoc_id
    $scope.$emit('file-tree:initialized')
  })

  $scope.$watch('permissions.write', hasWritePermissions => {
    $scope.hasWritePermissions = hasWritePermissions
  })

  $scope.$watch('editor.open_doc_id', openDocId => {
    window.dispatchEvent(
      new CustomEvent('editor.openDoc', { detail: openDocId })
    )
  })

  $scope.onInit = () => {
    // HACK: resize the vertical pane on init after a 0ms timeout. We do not
    // understand why this is necessary but without this the resized handle is
    // stuck at the bottom. The vertical resize will soon be migrated to React
    // so we accept to live with this hack for now.
    $timeout(() => {
      $scope.$emit('left-pane-resize-all')
    })
  }

  $scope.onSelect = selectedEntities => {
    if (selectedEntities.length === 1) {
      const selectedEntity = selectedEntities[0]
      $scope.$emit('entity:selected', {
        id: selectedEntity.entity._id,
        name: selectedEntity.entity.name,
        type: selectedEntity.type
      })

      // in the react implementation there is no such concept as "1
      // multi-selected entity" so here we pass a count of 0
      $scope.$emit('entities:multiSelected', { count: 0 })
    } else if (selectedEntities.length > 1) {
      $scope.$emit('entities:multiSelected', { count: selectedEntities.length })
    }
  }
})

App.component('fileTreeRoot', react2angular(FileTreeRoot))
