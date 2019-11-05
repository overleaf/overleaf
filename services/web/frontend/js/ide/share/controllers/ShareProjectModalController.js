define(['base'], App => {
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
    // eslint-disable-next-line camelcase
    eventTracking
  ) {
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
      $scope.canAddCollaborators =
        $scope.project.members.length + $scope.project.invites.length <
          allowedNoOfMembers || allowedNoOfMembers === INFINITE_COLLABORATORS
    }
    $scope.refreshCanAddCollaborators()

    $scope.$watch('canAddCollaborators', function() {
      if (!$scope.canAddCollaborators) {
        eventTracking.send(
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
    $http.get('/user/contacts').then(function(response) {
      const { data } = response
      $scope.autocompleteContacts = data.contacts || []
      for (let contact of $scope.autocompleteContacts) {
        if (contact.type === 'user') {
          if (
            contact.first_name === contact.email.split('@')[0] &&
            !contact.last_name
          ) {
            // User has not set their proper name so use email as canonical display property
            contact.display = contact.email
          } else {
            contact.name = `${contact.first_name} ${contact.last_name}`
            contact.display = `${contact.name} <${contact.email}>`
          }
        } else {
          // Must be a group
          contact.display = contact.name
        }
      }
    })

    const getCurrentMemberEmails = () =>
      ($scope.project.members || []).map(u => u.email)

    const getCurrentInviteEmails = () =>
      ($scope.project.invites || []).map(u => u.email)

    $scope.filterAutocompleteUsers = function($query) {
      const currentMemberEmails = getCurrentMemberEmails()
      return $scope.autocompleteContacts.filter(function(contact) {
        if (
          contact.email != null &&
          currentMemberEmails.includes(contact.email)
        ) {
          return false
        }
        for (let text of [contact.name, contact.email]) {
          if (
            text != null &&
            text.toLowerCase().indexOf($query.toLowerCase()) > -1
          ) {
            return true
          }
        }
        return false
      })
    }

    $scope.addMembers = function() {
      const addMembers = function() {
        if ($scope.inputs.contacts.length === 0) {
          return
        }

        const members = $scope.inputs.contacts
        $scope.inputs.contacts = []
        $scope.clearError()
        $scope.state.inflight = true

        if ($scope.project.invites == null) {
          $scope.project.invites = []
        }

        const currentMemberEmails = getCurrentMemberEmails()
        const currentInviteEmails = getCurrentInviteEmails()
        addNextMember()

        function addNextMember() {
          let email
          if (members.length === 0 || !$scope.canAddCollaborators) {
            $scope.state.inflight = false
            $scope.$apply()
            return
          }

          const member = members.shift()
          if (member.type === 'user') {
            email = member.email
          } else {
            // Not an auto-complete object, so email == display
            email = member.display
          }
          email = email.toLowerCase()

          if (currentMemberEmails.includes(email)) {
            // Skip this existing member
            return addNextMember()
          }
          // do v3 captcha to collect data only
          validateCaptchaV3('invite')
          // do v2 captcha
          const ExposedSettings = window.ExposedSettings
          validateCaptcha(function(response) {
            $scope.grecaptchaResponse = response
            const invites = $scope.project.invites || []
            const invite = _.find(invites, invite => invite.email === email)
            let request
            if (currentInviteEmails.includes(email) && invite) {
              request = projectInvites.resendInvite(invite._id)
            } else {
              request = projectInvites.sendInvite(
                email,
                $scope.inputs.privileges,
                $scope.grecaptchaResponse
              )
            }

            request
              .then(function(response) {
                const { data } = response
                if (data.error) {
                  $scope.setError(data.error)
                  $scope.state.inflight = false
                } else {
                  if (data.invite) {
                    const { invite } = data
                    $scope.project.invites.push(invite)
                  } else {
                    const users =
                      data.users != null
                        ? data.users
                        : data.user != null
                          ? [data.user]
                          : []
                    $scope.project.members.push(...users)
                  }
                }

                setTimeout(
                  () =>
                    // Give $scope a chance to update $scope.canAddCollaborators
                    // with new collaborator information.
                    addNextMember(),

                  0
                )
              })
              .catch(function(httpResponse) {
                const { data } = httpResponse
                $scope.state.inflight = false
                $scope.setError(data.errorReason)
              })
          }, ExposedSettings.recaptchaDisabled.invite)
        }
      }

      $timeout(addMembers, 50) // Give email list a chance to update
    }

    $scope.removeMember = function(member) {
      $scope.monitorRequest(
        projectMembers.removeMember(member).then(function() {
          const index = $scope.project.members.indexOf(member)
          if (index === -1) {
            return
          }
          $scope.project.members.splice(index, 1)
        })
      )
    }

    $scope.revokeInvite = function(invite) {
      $scope.monitorRequest(
        projectInvites.revokeInvite(invite._id).then(function() {
          const index = $scope.project.invites.indexOf(invite)
          if (index === -1) {
            return
          }
          $scope.project.invites.splice(index, 1)
        })
      )
    }

    $scope.resendInvite = function(invite, event) {
      $scope.monitorRequest(
        projectInvites
          .resendInvite(invite._id)
          .then(function() {
            event.target.blur()
          })
          .catch(function() {
            event.target.blur()
          })
      )
    }

    $scope.makeTokenBased = function() {
      $scope.project.publicAccesLevel = 'tokenBased'
      settings.saveProjectAdminSettings({ publicAccessLevel: 'tokenBased' })
      eventTracking.sendMB('project-make-token-based')
    }

    $scope.makePrivate = function() {
      $scope.project.publicAccesLevel = 'private'
      settings.saveProjectAdminSettings({ publicAccessLevel: 'private' })
    }

    $scope.$watch('project.tokens.readAndWrite', function(token) {
      if (token != null) {
        $scope.readAndWriteTokenLink = `${location.origin}/${token}`
      } else {
        $scope.readAndWriteTokenLink = null
      }
    })

    $scope.$watch('project.tokens.readOnly', function(token) {
      if (token != null) {
        $scope.readOnlyTokenLink = `${location.origin}/read/${token}`
      } else {
        $scope.readOnlyTokenLink = null
      }
    })

    $scope.done = () => $modalInstance.close()

    $scope.cancel = () => $modalInstance.dismiss()

    $scope.monitorRequest = function monitorRequest(request) {
      $scope.clearError()
      $scope.state.inflight = true
      return request
        .then(() => {
          $scope.state.inflight = false
          $scope.clearError()
        })
        .catch(err => {
          $scope.state.inflight = false
          $scope.setError(err.data && err.data.error)
        })
    }

    $scope.clearError = function clearError() {
      $scope.state.error = false
    }

    $scope.setError = function setError(reason) {
      $scope.state.error = true
      $scope.state.errorReason = reason
    }
  })
})
