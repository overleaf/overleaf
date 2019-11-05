define(['base'], App =>
  App.controller('LeftHandMenuPromoController', function(
    $scope,
    UserAffiliationsDataService
  ) {
    $scope.hasProjects = window.data.projects.length > 0
    $scope.userHasNoSubscription = window.userHasNoSubscription

    const _userHasNoAffiliation = function() {
      $scope.userEmails = []
      $scope.userAffiliations = []
      return UserAffiliationsDataService.getUserEmails().then(function(emails) {
        $scope.userEmails = emails
        $scope.userAffiliations = emails
          .filter(email => email.affiliation)
          .map(email => email.affiliation)
        $scope.userOnPayingUniversity = $scope.userAffiliations.some(
          affiliation => affiliation.institution.licence !== 'free'
        )
      })
    }

    _userHasNoAffiliation()
  }))
