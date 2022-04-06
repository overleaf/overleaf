import App from '../../base'

export default App.controller(
  'LeftHandMenuPromoController',
  function ($scope, UserAffiliationsDataService, eventTracking) {
    $scope.hasProjects = window.data.projects.length > 0
    $scope.userHasNoSubscription = window.userHasNoSubscription

    $scope.upgradeSubscription = function () {
      eventTracking.send('subscription-funnel', 'project-page', 'upgrade')
      eventTracking.sendMB('upgrade-button-click', {
        source: 'dashboard',
      })
    }

    $scope.share = function () {
      eventTracking.send('subscription-funnel', 'project-page', 'sharing')
    }

    const _userHasNoAffiliation = function () {
      $scope.withAffiliations = window.data.userAffiliations.length > 0
      $scope.userOnPayingUniversity = window.data.userAffiliations.some(
        affiliation => affiliation.licence && affiliation.licence !== 'free'
      )
    }

    _userHasNoAffiliation()
  }
)
