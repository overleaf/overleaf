import App from '../../../base'
import iconTypeFromName from '../util/iconTypeFromName'
App.controller(
  'FileTreeEntityController',
  function ($scope, ide, $modal, $element) {
    $scope.MAX_DEPTH = 8

    $scope.select = function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.stopPropagation()
        const initialMultiSelectCount = ide.fileTreeManager.multiSelectedCount()
        ide.fileTreeManager.toggleMultiSelectEntity($scope.entity)
        if (initialMultiSelectCount === 0) {
          // On first multi selection, also include the current active/open file.
          return ide.fileTreeManager.multiSelectSelectedEntity()
        }
      } else {
        ide.fileTreeManager.selectEntity($scope.entity)
        return $scope.$emit('entity:selected', $scope.entity)
      }
    }

    if ($scope.entity.type === 'doc') {
      $scope.$watch('entity.selected', function (isSelected) {
        if (isSelected) {
          $scope.$emit('entity-file:selected', $scope.entity)
          if (!_isEntryElVisible($element)) {
            $scope.$applyAsync(function () {
              $element[0].scrollIntoView()
            })
          }
        }
      })
    }

    function _isEntryElVisible($entryEl) {
      const viewportEl = $('.file-tree-list')
      const entryElTop = $entryEl.offset().top
      const entryElBottom = entryElTop + $entryEl.outerHeight()
      const entryListViewportElTop = viewportEl.offset().top
      const entryListViewportElBottom =
        entryListViewportElTop + viewportEl.height()

      return (
        entryElTop >= entryListViewportElTop &&
        entryElBottom <= entryListViewportElBottom
      )
    }

    $scope.iconTypeFromName = iconTypeFromName
  }
)
