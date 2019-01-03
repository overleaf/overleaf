define(['base'], function(App) {
  App.controller('ImportingController', function(
    $interval,
    $scope,
    $timeout,
    $window
  ) {
    $interval(function() {
      $scope.state.load_progress += 5
      if ($scope.state.load_progress > 100) {
        $scope.state.load_progress = 20
      }
    }, 500)
    $timeout(function() {
      $window.location.reload()
    }, 5000)
    $scope.state = {
      load_progress: 20
    }
  })
})
