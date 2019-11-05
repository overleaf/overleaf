define(['base'], App =>
  App.directive('historyDraggableBoundary', () => ({
    scope: {
      historyDraggableBoundary: '@',
      historyDraggableBoundaryOnDragStart: '&',
      historyDraggableBoundaryOnDragStop: '&'
    },
    restrict: 'A',
    link(scope, element, attrs) {
      element.data('selectionBoundary', {
        boundary: scope.historyDraggableBoundary
      })
      element.draggable({
        axis: 'y',
        opacity: false,
        helper: 'clone',
        revert: true,
        scroll: true,
        cursor: 'row-resize',
        start(e, ui) {
          ui.helper.data('wasProperlyDropped', false)
          scope.historyDraggableBoundaryOnDragStart()
        },
        stop(e, ui) {
          scope.historyDraggableBoundaryOnDragStop({
            isValidDrop: ui.helper.data('wasProperlyDropped'),
            boundary: scope.historyDraggableBoundary
          })
        }
      })
    }
  })))
