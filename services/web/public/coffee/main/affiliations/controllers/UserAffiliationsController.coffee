define [
	"base"
], (App) ->
	App.controller "UserAffiliationsController", ["$scope", "UserAffiliationsDataService", "$q", "_", ($scope, UserAffiliationsDataService, $q, _) ->
		$scope.userEmails = []

		LOCAL_AND_DOMAIN_REGEX = /([^@]+)@(.+)/
		EMAIL_REGEX = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\ ".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA -Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

		_matchLocalAndDomain = (userEmailInput) ->
			match = userEmailInput?.match LOCAL_AND_DOMAIN_REGEX
			if match?
				{ local: match[1], domain: match[2] }
			else
				{ local: null, domain: null }

		$scope.getEmailSuggestion = (userInput) ->
			userInputLocalAndDomain = _matchLocalAndDomain(userInput)
			$scope.ui.isValidEmail = EMAIL_REGEX.test userInput
			$scope.ui.isBlacklistedEmail = false
			$scope.ui.showManualUniversitySelectionUI = false
			if userInputLocalAndDomain.domain?
				$scope.ui.isBlacklistedEmail = UserAffiliationsDataService.isDomainBlacklisted userInputLocalAndDomain.domain
				UserAffiliationsDataService.getUniversityDomainFromPartialDomainInput(userInputLocalAndDomain.domain)
					.then (universityDomain) ->
						currentUserInputLocalAndDomain = _matchLocalAndDomain $scope.newAffiliation.email
						if currentUserInputLocalAndDomain.domain == universityDomain.hostname
							$scope.newAffiliation.university = universityDomain.university
							$scope.newAffiliation.department = universityDomain.department
						else 
							$scope.newAffiliation.university = null
							$scope.newAffiliation.department = null
						$q.resolve "#{userInputLocalAndDomain.local}@#{universityDomain.hostname}"
					.catch () -> 
						$scope.newAffiliation.university = null
						$scope.newAffiliation.department = null
						$q.reject null
			else
				$scope.newAffiliation.university = null
				$scope.newAffiliation.department = null
				$q.reject null


		$scope.selectUniversityManually = () ->
			$scope.newAffiliation.university = null
			$scope.newAffiliation.department = null
			$scope.ui.showManualUniversitySelectionUI = true

		$scope.changeAffiliation = (userEmail) ->
			if userEmail.affiliation?.institution?.id?
				UserAffiliationsDataService.getUniversityDetails userEmail.affiliation.institution.id
					.then (universityDetails) -> $scope.affiliationToChange.university = universityDetails

			$scope.affiliationToChange.email = userEmail.email
			$scope.affiliationToChange.role = userEmail.affiliation.role
			$scope.affiliationToChange.department = userEmail.affiliation.department

		$scope.saveAffiliationChange = (userEmail) ->
			userEmail.affiliation.role = $scope.affiliationToChange.role
			userEmail.affiliation.department = $scope.affiliationToChange.department
			_resetAffiliationToChange()
			_monitorRequest(
				UserAffiliationsDataService
					.addRoleAndDepartment(
						userEmail.email,
						userEmail.affiliation.role,
						userEmail.affiliation.department
					)
			)
				.then () ->
					setTimeout () -> _getUserEmails()

		$scope.cancelAffiliationChange = (email) ->
			_resetAffiliationToChange()
		
		$scope.isChangingAffiliation = (email) ->
			$scope.affiliationToChange.email == email

		$scope.showAddEmailForm = () ->
			$scope.ui.showAddEmailUI = true

		$scope.addNewEmail = () ->
			if !$scope.newAffiliation.university?
				addEmailPromise = UserAffiliationsDataService
					.addUserEmail $scope.newAffiliation.email
			else
				if $scope.newAffiliation.university.isUserSuggested
					addEmailPromise = UserAffiliationsDataService
						.addUserAffiliationWithUnknownUniversity(
							$scope.newAffiliation.email,
							$scope.newAffiliation.university.name, 
							$scope.newAffiliation.country.code,
							$scope.newAffiliation.role,
							$scope.newAffiliation.department
						)
				else
					addEmailPromise = UserAffiliationsDataService
						.addUserAffiliation(
							$scope.newAffiliation.email,
							$scope.newAffiliation.university.id
							$scope.newAffiliation.role,
							$scope.newAffiliation.department
						)

			$scope.ui.isAddingNewEmail = true
			$scope.ui.showAddEmailUI = false
			_monitorRequest(addEmailPromise)
				.then () ->
					_resetNewAffiliation()
					_resetAddingEmail()
					setTimeout () -> _getUserEmails()
				.finally () ->
					$scope.ui.isAddingNewEmail = false

		$scope.setDefaultUserEmail = (userEmail) ->
			_monitorRequest(
				UserAffiliationsDataService
					.setDefaultUserEmail userEmail.email
			)
				.then () ->
					for email in $scope.userEmails or []
						email.default = false
					userEmail.default = true

		$scope.removeUserEmail = (userEmail) ->
			$scope.userEmails = $scope.userEmails.filter (ue) -> ue != userEmail
			_monitorRequest(
				UserAffiliationsDataService
					.removeUserEmail userEmail.email
			)

		$scope.resendConfirmationEmail = (userEmail) ->
			$scope.ui.isResendingConfirmation = true
			_monitorRequest(
				UserAffiliationsDataService
					.resendConfirmationEmail userEmail.email
			)
				.finally () ->
					$scope.ui.isResendingConfirmation = false

		$scope.acknowledgeError = () ->
			_reset()
			_getUserEmails()

		_resetAffiliationToChange = () ->
			$scope.affiliationToChange = 
				email: ""
				university: null
				role: null
				department: null

		_resetNewAffiliation = () ->
			$scope.newAffiliation =
				email: ""
				country: null
				university: null
				role: null
				department: null

		_resetAddingEmail = () ->
			$scope.ui.showAddEmailUI = false
			$scope.ui.isValidEmail = false
			$scope.ui.isBlacklistedEmail = false
			$scope.ui.showManualUniversitySelectionUI = false

		_reset = () ->
			$scope.ui = 
				hasError: false
				errorMessage: ""
				showChangeAffiliationUI: false
				isMakingRequest: false
				isLoadingEmails: false
				isAddingNewEmail: false
				isResendingConfirmation: false
			_resetAffiliationToChange()
			_resetNewAffiliation()
			_resetAddingEmail()
		_reset()

		_monitorRequest = (promise) ->
			$scope.ui.hasError = false
			$scope.ui.isMakingRequest = true
			promise
				.catch (response) ->
					$scope.ui.hasError = true
					$scope.ui.errorMessage = response?.data?.message
				.finally () ->
					$scope.ui.isMakingRequest = false
			return promise

		# Populates the emails table
		_getUserEmails = () ->
			$scope.ui.isLoadingEmails = true
			_monitorRequest(
				UserAffiliationsDataService
					.getUserEmails()
			)
				.then (emails) -> 
					$scope.userEmails = emails
				.finally () ->
					$scope.ui.isLoadingEmails = false
		_getUserEmails()

	]