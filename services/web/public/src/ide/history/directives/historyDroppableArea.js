define(['base'], App =>
  App.directive('historyDroppableArea', () => ({
    scope: {
      historyDroppableAreaOnDrop: '&',
      historyDroppableAreaOnOver: '&',
      historyDroppableAreaOnOut: '&'
    },
    restrict: 'A',
    link(scope, element, attrs) {
      element.droppable({
        accept: e => '.history-entry-toV-handle, .history-entry-fromV-handle',
        drop: (e, ui) => {
          const draggedBoundary = ui.draggable.data('selectionBoundary')
            .boundary
          ui.helper.data('wasProperlyDropped', true)
          scope.historyDroppableAreaOnDrop({ boundary: draggedBoundary })
        },
        over: (e, ui) => {
          const draggedBoundary = ui.draggable.data('selectionBoundary')
            .boundary
          scope.historyDroppableAreaOnOver({ boundary: draggedBoundary })
        }
      })
    }
  })))
