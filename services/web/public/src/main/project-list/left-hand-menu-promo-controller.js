/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
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
        return (() => {
          const result = []
          for (let email of Array.from(emails)) {
            if (email.affiliation) {
              result.push($scope.userAffiliations.push(email.affiliation))
            } else {
              result.push(undefined)
            }
          }
          return result
        })()
      })
    }

    return _userHasNoAffiliation()
  }))
