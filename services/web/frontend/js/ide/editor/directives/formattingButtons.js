import App from '../../../base'

export default App.directive('formattingButtons', () => ({
  scope: {
    buttons: '=',
    opening: '=',
    isFullscreenEditor: '=',
  },

  link(scope, element, attrs) {
    scope.showMore = false
    scope.shownButtons = scope.buttons
    scope.overflowedButtons = []
  },

  templateUrl: 'formattingButtonsTpl',
}))
