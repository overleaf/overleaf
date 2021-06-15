import App from '../../../base'
App.controller('FileTreeController', function ($scope) {
  $scope.openNewDocModal = () => {
    window.dispatchEvent(
      new CustomEvent('file-tree.start-creating', { detail: { mode: 'doc' } })
    )
  }

  $scope.orderByFoldersFirst = function (entity) {
    if ((entity != null ? entity.type : undefined) === 'folder') {
      return '0'
    }
    return '1'
  }
})
