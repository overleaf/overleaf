/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('UserAffiliationsController', function(
    $scope,
    UserAffiliationsDataService,
    $q,
    $window,
    _
  ) {
    $scope.userEmails = []
    $scope.linkedInstitutionIds = []
    $scope.hideInstitutionNotifications = {}
    $scope.closeInstitutionNotification = type => {
      $scope.hideInstitutionNotifications[type] = true
    }
    $scope.hasSamlBeta = ExposedSettings.hasSamlBeta
    $scope.hasSamlFeature = ExposedSettings.hasSamlFeature
    $scope.samlInitPath = ExposedSettings.samlInitPath
    $scope.shouldShowRolesAndAddEmailButton = () => {
      const newAffiliation = $scope.newAffiliation
      const hasSamlFeature = $scope.hasSamlFeature || $scope.hasSamlBeta
      return (
        !newAffiliation ||
        (newAffiliation && !newAffiliation.university) ||
        (!hasSamlFeature && newAffiliation && newAffiliation.university) ||
        (hasSamlFeature &&
          newAffiliation &&
          newAffiliation.university &&
          !newAffiliation.university.ssoEnabled)
      )
    }
    const LOCAL_AND_DOMAIN_REGEX = /([^@]+)@(.+)/
    const EMAIL_REGEX = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\ ".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA -Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

    const _matchLocalAndDomain = function(userEmailInput) {
      const match =
        userEmailInput != null
          ? userEmailInput.match(LOCAL_AND_DOMAIN_REGEX)
          : undefined
      if (match != null) {
        return { local: match[1], domain: match[2] }
      } else {
        return { local: null, domain: null }
      }
    }

    $scope.getEmailSuggestion = function(userInput) {
      const userInputLocalAndDomain = _matchLocalAndDomain(userInput)
      $scope.ui.isValidEmail = EMAIL_REGEX.test(userInput)
      $scope.ui.isBlacklistedEmail = false
      $scope.ui.showManualUniversitySelectionUI = false
      if (userInputLocalAndDomain.domain != null) {
        $scope.ui.isBlacklistedEmail = UserAffiliationsDataService.isDomainBlacklisted(
          userInputLocalAndDomain.domain
        )
        return UserAffiliationsDataService.getUniversityDomainFromPartialDomainInput(
          userInputLocalAndDomain.domain
        )
          .then(function(universityDomain) {
            const currentUserInputLocalAndDomain = _matchLocalAndDomain(
              $scope.newAffiliation.email
            )
            if (
              currentUserInputLocalAndDomain.domain ===
              universityDomain.hostname
            ) {
              $scope.newAffiliation.university = universityDomain.university
              $scope.newAffiliation.department = universityDomain.department
            } else {
              $scope.newAffiliation.university = null
              $scope.newAffiliation.department = null
            }
            return $q.resolve(
              `${userInputLocalAndDomain.local}@${universityDomain.hostname}`
            )
          })
          .catch(function() {
            $scope.newAffiliation.university = null
            $scope.newAffiliation.department = null
            return $q.reject(null)
          })
      } else {
        $scope.newAffiliation.university = null
        $scope.newAffiliation.department = null
        return $q.reject(null)
      }
    }

    $scope.linkInstitutionAcct = function(email, institutionId) {
      _resetMakingRequestType()
      $scope.ui.isMakingRequest = true
      $scope.ui.isProcessing = true
      $window.location.href = `${
        $scope.samlInitPath
      }?university_id=${institutionId}&auto=true&email=${email}`
    }

    $scope.selectUniversityManually = function() {
      $scope.newAffiliation.university = null
      $scope.newAffiliation.department = null
      return ($scope.ui.showManualUniversitySelectionUI = true)
    }

    $scope.changeAffiliation = function(userEmail) {
      if (
        __guard__(
          userEmail.affiliation != null
            ? userEmail.affiliation.institution
            : undefined,
          x => x.id
        ) != null
      ) {
        UserAffiliationsDataService.getUniversityDetails(
          userEmail.affiliation.institution.id
        ).then(
          universityDetails =>
            ($scope.affiliationToChange.university = universityDetails)
        )
      }

      $scope.affiliationToChange.email = userEmail.email
      $scope.affiliationToChange.role = userEmail.affiliation.role
      return ($scope.affiliationToChange.department =
        userEmail.affiliation.department)
    }

    $scope.saveAffiliationChange = function(userEmail) {
      userEmail.affiliation.role = $scope.affiliationToChange.role
      userEmail.affiliation.department = $scope.affiliationToChange.department
      _resetAffiliationToChange()
      return _monitorRequest(
        UserAffiliationsDataService.addRoleAndDepartment(
          userEmail.email,
          userEmail.affiliation.role,
          userEmail.affiliation.department
        )
      ).then(() => setTimeout(() => _getUserEmails()))
    }

    $scope.cancelAffiliationChange = email => _resetAffiliationToChange()

    $scope.isChangingAffiliation = email =>
      $scope.affiliationToChange.email === email

    $scope.showAddEmailForm = () => ($scope.ui.showAddEmailUI = true)

    $scope.addNewEmail = function() {
      let addEmailPromise
      if ($scope.newAffiliation.university == null) {
        addEmailPromise = UserAffiliationsDataService.addUserEmail(
          $scope.newAffiliation.email
        )
      } else {
        if ($scope.newAffiliation.university.isUserSuggested) {
          addEmailPromise = UserAffiliationsDataService.addUserAffiliationWithUnknownUniversity(
            $scope.newAffiliation.email,
            $scope.newAffiliation.university.name,
            $scope.newAffiliation.country.code,
            $scope.newAffiliation.role,
            $scope.newAffiliation.department
          )
        } else {
          addEmailPromise = UserAffiliationsDataService.addUserAffiliation(
            $scope.newAffiliation.email,
            $scope.newAffiliation.university.id,
            $scope.newAffiliation.role,
            $scope.newAffiliation.department
          )
        }
      }

      $scope.ui.isAddingNewEmail = true
      $scope.ui.showAddEmailUI = false
      return _monitorRequest(addEmailPromise)
        .then(function() {
          _resetNewAffiliation()
          _resetAddingEmail()
          return setTimeout(() => _getUserEmails())
        })
        .finally(() => ($scope.ui.isAddingNewEmail = false))
    }

    $scope.setDefaultUserEmail = userEmail =>
      _monitorRequest(
        UserAffiliationsDataService.setDefaultUserEmail(userEmail.email)
      ).then(function() {
        for (let email of Array.from($scope.userEmails || [])) {
          email.default = false
        }
        return (userEmail.default = true)
      })

    $scope.removeUserEmail = function(userEmail) {
      $scope.userEmails = $scope.userEmails.filter(ue => ue !== userEmail)
      return _monitorRequest(
        UserAffiliationsDataService.removeUserEmail(userEmail.email)
      )
    }

    $scope.resendConfirmationEmail = function(userEmail) {
      _resetMakingRequestType()
      $scope.ui.isResendingConfirmation = true
      return _monitorRequest(
        UserAffiliationsDataService.resendConfirmationEmail(userEmail.email)
      ).finally(() => ($scope.ui.isResendingConfirmation = false))
    }

    $scope.acknowledgeError = function() {
      _reset()
      return _getUserEmails()
    }

    var _resetAffiliationToChange = () =>
      ($scope.affiliationToChange = {
        email: '',
        university: null,
        role: null,
        department: null
      })

    var _resetNewAffiliation = () =>
      ($scope.newAffiliation = {
        email: '',
        country: null,
        university: null,
        role: null,
        department: null
      })

    var _resetAddingEmail = function() {
      $scope.ui.showAddEmailUI = false
      $scope.ui.isValidEmail = false
      $scope.ui.isBlacklistedEmail = false
      return ($scope.ui.showManualUniversitySelectionUI = false)
    }

    var _resetMakingRequestType = function() {
      $scope.ui.isLoadingEmails = false
      $scope.ui.isProcessing = false
      $scope.ui.isResendingConfirmation = false
    }

    var _reset = function() {
      $scope.ui = {
        hasError: false,
        errorMessage: '',
        showChangeAffiliationUI: false,
        isMakingRequest: false,
        isLoadingEmails: false,
        isAddingNewEmail: false
      }
      _resetAffiliationToChange()
      _resetNewAffiliation()
      return _resetAddingEmail()
    }
    _reset()

    var _monitorRequest = function(promise) {
      $scope.ui.hasError = false
      $scope.ui.isMakingRequest = true
      promise
        .catch(function(response) {
          $scope.ui.hasError = true
          return ($scope.ui.errorMessage = __guard__(
            response != null ? response.data : undefined,
            x => x.message
          ))
        })
        .finally(() => ($scope.ui.isMakingRequest = false))
      return promise
    }

    $scope.institutionAlreadyLinked = function(emailData) {
      const institutionId =
        emailData.affiliation &&
        emailData.affiliation.institution &&
        emailData.affiliation.institution &&
        emailData.affiliation.institution.id
          ? emailData.affiliation.institution.id.toString()
          : undefined
      return $scope.linkedInstitutionIds.indexOf(institutionId) !== -1
    }

    // Populates the emails table
    var _getUserEmails = function() {
      _resetMakingRequestType()
      $scope.ui.isLoadingEmails = true
      return _monitorRequest(UserAffiliationsDataService.getUserEmails())
        .then(emails => {
          $scope.userEmails = emails
          $scope.linkedInstitutionIds = emails
            .filter(email => {
              if (email.samlProviderId) {
                return email.samlProviderId
              }
            })
            .map(email => email.samlProviderId)
        })
        .finally(() => ($scope.ui.isLoadingEmails = false))
    }
    return _getUserEmails()
  }))
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
