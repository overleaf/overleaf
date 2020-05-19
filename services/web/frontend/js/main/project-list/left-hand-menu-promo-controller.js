import App from '../../base'

export default App.controller('LeftHandMenuPromoController', function(
  $scope,
  UserAffiliationsDataService,
  eventTracking
) {
  $scope.hasProjects = window.data.projects.length > 0
  $scope.userHasNoSubscription = window.userHasNoSubscription

  $scope.upgradeSubscription = function() {
    eventTracking.send('subscription-funnel', 'project-page', 'upgrade')
  }

  $scope.share = function() {
    eventTracking.send('subscription-funnel', 'project-page', 'sharing')
  }

  const _userHasNoAffiliation = function() {
    $scope.userEmails = []
    $scope.userAffiliations = []
    return UserAffiliationsDataService.getUserEmails().then(function(emails) {
      $scope.userEmails = emails
      $scope.userAffiliations = emails
        .filter(email => email.affiliation)
        .map(email => email.affiliation)
      $scope.userOnPayingUniversity = $scope.userAffiliations.some(
        affiliation => affiliation.licence && affiliation.licence !== 'free'
      )
    })
  }

  _userHasNoAffiliation()
})
