import App from '../../../base'

export default App.controller(
  'LeftMenuDocumentationController',
  function ($scope, eventTracking) {
    $scope.sendLeftMenuDocumentationEvent = () => {
      eventTracking.sendMB('left-menu-documentation-click')
    }
  }
)
