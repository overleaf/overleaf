define(['base'], App => {
  let content = ''
  App.directive('addCommentEntry', () => ({
    restrict: 'E',
    templateUrl: 'addCommentEntryTemplate',
    scope: {
      onStartNew: '&',
      onSubmit: '&',
      onCancel: '&'
    },
    link(scope, element, attrs) {
      scope.state = {
        isAdding: false,
        content: content
      }

      scope.$on('comment:start_adding', () => scope.startNewComment())
      scope.$on('$destroy', function() {
        content = scope.state.content
      })

      scope.startNewComment = function() {
        scope.state.isAdding = true
        scope.onStartNew()
        setTimeout(() => scope.$broadcast('comment:new:open'))
      }

      scope.cancelNewComment = function() {
        scope.state.isAdding = false
        scope.state.content = ''
        scope.onCancel()
      }

      scope.handleCommentKeyPress = function(ev) {
        if (ev.keyCode === 13 && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey) {
          ev.preventDefault()
          if (scope.state.content.length > 0) {
            scope.submitNewComment()
          }
        }
      }

      scope.submitNewComment = function(event) {
        scope.onSubmit({ content: scope.state.content })
        content = scope.state.content
        scope.state.isAdding = false
        scope.state.content = ''
      }
    }
  }))
})
