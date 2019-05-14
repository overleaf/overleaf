/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('ShareProjectModalController', function(
    $scope,
    $modalInstance,
    $timeout,
    projectMembers,
    projectInvites,
    $modal,
    $http,
    ide,
    validateCaptcha,
    validateCaptchaV3,
    settings,
    event_tracking
  ) {
    let loadAutocompleteUsers
    $scope.inputs = {
      privileges: 'readAndWrite',
      contacts: []
    }
    $scope.state = {
      error: null,
      errorReason: null,
      inflight: false,
      startedFreeTrial: false,
      invites: []
    }

    $modalInstance.opened.then(() =>
      $timeout(() => $scope.$broadcast('open'), 200)
    )

    const INFINITE_COLLABORATORS = -1

    $scope.refreshCanAddCollaborators = function() {
      const allowedNoOfMembers = $scope.project.features.collaborators
      return ($scope.canAddCollaborators =
        $scope.project.members.length + $scope.project.invites.length <
          allowedNoOfMembers || allowedNoOfMembers === INFINITE_COLLABORATORS)
    }
    $scope.refreshCanAddCollaborators()

    $scope.$watch('canAddCollaborators', function() {
      if (!$scope.canAddCollaborators) {
        event_tracking.send(
          'subscription-funnel',
          'editor-click-feature',
          'projectMembers'
        )
      }
    })

    $scope.$watch(
      '(project.members.length + project.invites.length)',
      _noOfMembers => $scope.refreshCanAddCollaborators()
    )

    $scope.autocompleteContacts = []
    ;(loadAutocompleteUsers = () =>
      $http.get('/user/contacts').then(function(response) {
        const { data } = response
        $scope.autocompleteContacts = data.contacts || []
        return (() => {
          const result = []
          for (let contact of Array.from($scope.autocompleteContacts)) {
            if (contact.type === 'user') {
              if (
                contact.first_name === contact.email.split('@')[0] &&
                !contact.last_name
              ) {
                // User has not set their proper name so use email as canonical display property
                result.push((contact.display = contact.email))
              } else {
                contact.name = `${contact.first_name} ${contact.last_name}`
                result.push(
                  (contact.display = `${contact.name} <${contact.email}>`)
                )
              }
            } else {
              // Must be a group
              result.push((contact.display = contact.name))
            }
          }
          return result
        })()
      }))()

    const getCurrentMemberEmails = () =>
      ($scope.project.members || []).map(u => u.email)

    const getCurrentInviteEmails = () =>
      ($scope.project.invites || []).map(u => u.email)

    $scope.filterAutocompleteUsers = function($query) {
      const currentMemberEmails = getCurrentMemberEmails()
      return $scope.autocompleteContacts.filter(function(contact) {
        if (
          contact.email != null &&
          Array.from(currentMemberEmails).includes(contact.email)
        ) {
          return false
        }
        for (let text of [contact.name, contact.email]) {
          if (
            (text != null
              ? text.toLowerCase().indexOf($query.toLowerCase())
              : undefined) > -1
          ) {
            return true
          }
        }
        return false
      })
    }

    $scope.addMembers = function() {
      const addMembers = function() {
        let addNextMember
        if ($scope.inputs.contacts.length === 0) {
          return
        }

        const members = $scope.inputs.contacts
        $scope.inputs.contacts = []
        $scope.state.error = false
        $scope.state.errorReason = null
        $scope.state.inflight = true

        if ($scope.project.invites == null) {
          $scope.project.invites = []
        }

        const currentMemberEmails = getCurrentMemberEmails()
        const currentInviteEmails = getCurrentInviteEmails()
        return (addNextMember = function() {
          let email
          if (members.length === 0 || !$scope.canAddCollaborators) {
            $scope.state.inflight = false
            $scope.$apply()
            return
          }

          const member = members.shift()
          if (member.type === 'user') {
            ;({ email } = member)
          } else {
            // Not an auto-complete object, so email == display
            email = member.display
          }
          email = email.toLowerCase()

          if (Array.from(currentMemberEmails).includes(email)) {
            // Skip this existing member
            return addNextMember()
          }
          // do v3 captcha to collect data only
          validateCaptchaV3('invite')
          // do v2 captcha
          const ExposedSettings = window.ExposedSettings
          return validateCaptcha(function(response) {
            let inviteId, request
            $scope.grecaptchaResponse = response
            if (
              Array.from(currentInviteEmails).includes(email) &&
              (inviteId = __guard__(
                _.find(
                  $scope.project.invites || [],
                  invite => invite.email === email
                ),
                x => x._id
              ))
            ) {
              request = projectInvites.resendInvite(inviteId)
            } else {
              request = projectInvites.sendInvite(
                email,
                $scope.inputs.privileges,
                $scope.grecaptchaResponse
              )
            }

            return request
              .then(function(response) {
                const { data } = response
                if (data.error) {
                  $scope.state.error = true
                  $scope.state.errorReason = `${data.error}`
                  $scope.state.inflight = false
                } else {
                  if (data.invite) {
                    const { invite } = data
                    $scope.project.invites.push(invite)
                  } else {
                    let users
                    if (data.users != null) {
                      ;({ users } = data)
                    } else if (data.user != null) {
                      users = [data.user]
                    } else {
                      users = []
                    }
                    $scope.project.members.push(...Array.from(users || []))
                  }
                }

                return setTimeout(
                  () =>
                    // Give $scope a chance to update $scope.canAddCollaborators
                    // with new collaborator information.
                    addNextMember(),

                  0
                )
              })
              .catch(function(httpResponse) {
                const { data, status, headers, config } = httpResponse
                $scope.state.inflight = false
                $scope.state.error = true

                if ((data != null ? data.errorReason : undefined) != null) {
                  return ($scope.state.errorReason =
                    data != null ? data.errorReason : undefined)
                } else {
                  return ($scope.state.errorReason = null)
                }
              })
          }, ExposedSettings.recaptchaDisabled.invite)
        })()
      }

      return $timeout(addMembers, 50) // Give email list a chance to update
    }

    $scope.removeMember = function(member) {
      $scope.state.error = null
      $scope.state.inflight = true
      return projectMembers
        .removeMember(member)
        .then(function() {
          $scope.state.inflight = false
          const index = $scope.project.members.indexOf(member)
          if (index === -1) {
            return
          }
          return $scope.project.members.splice(index, 1)
        })
        .catch(function() {
          $scope.state.inflight = false
          return ($scope.state.error = 'Sorry, something went wrong :(')
        })
    }

    $scope.revokeInvite = function(invite) {
      $scope.state.error = null
      $scope.state.inflight = true
      return projectInvites
        .revokeInvite(invite._id)
        .then(function() {
          $scope.state.inflight = false
          const index = $scope.project.invites.indexOf(invite)
          if (index === -1) {
            return
          }
          return $scope.project.invites.splice(index, 1)
        })
        .catch(function() {
          $scope.state.inflight = false
          return ($scope.state.error = 'Sorry, something went wrong :(')
        })
    }

    $scope.resendInvite = function(invite, event) {
      $scope.state.error = null
      $scope.state.inflight = true
      return projectInvites
        .resendInvite(invite._id)
        .then(function() {
          $scope.state.inflight = false
          return event.target.blur()
        })
        .catch(function() {
          $scope.state.inflight = false
          $scope.state.error =
            'Sorry, something went wrong resending the invite :('
          return event.target.blur()
        })
    }

    $scope.makeTokenBased = function() {
      $scope.project.publicAccesLevel = 'tokenBased'
      settings.saveProjectAdminSettings({ publicAccessLevel: 'tokenBased' })
      return event_tracking.sendMB('project-make-token-based')
    }

    $scope.makePrivate = function() {
      $scope.project.publicAccesLevel = 'private'
      return settings.saveProjectAdminSettings({ publicAccessLevel: 'private' })
    }

    $scope.$watch('project.tokens.readAndWrite', function(token) {
      if (token != null) {
        return ($scope.readAndWriteTokenLink = `${location.origin}/${token}`)
      } else {
        return ($scope.readAndWriteTokenLink = null)
      }
    })

    $scope.$watch('project.tokens.readOnly', function(token) {
      if (token != null) {
        return ($scope.readOnlyTokenLink = `${location.origin}/read/${token}`)
      } else {
        return ($scope.readOnlyTokenLink = null)
      }
    })

    $scope.done = () => $modalInstance.close()

    return ($scope.cancel = () => $modalInstance.dismiss())
  }))

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
