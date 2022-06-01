import App from '../../base'

export default App.controller(
  'LeftHandMenuPromoController',
  function ($scope, UserAffiliationsDataService, eventTracking) {
    $scope.hasProjects = window.data.projects.length > 0

    const _userHasNoAffiliation = function () {
      $scope.withAffiliations = window.data.userAffiliations.length > 0
    }

    _userHasNoAffiliation()
  }
)
