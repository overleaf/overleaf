define [
	"base"
], (App) ->
	App.controller "UserAffiliationsController", ["$scope", "UserAffiliationsDataService", "$q", "_", ($scope, UserAffiliationsDataService, $q, _) ->
		$scope.userEmails = []

		LOCAL_AND_DOMAIN_REGEX = /([^@]+)@(.+)/
		EMAIL_REGEX = /^([A-Za-z0-9_\-\.]+)@([^\.]+)\.([A-Za-z0-9_\-\.]+)([^\.])$/

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

		$scope.saveAffiliationChange = () ->
			$scope.ui.isLoadingEmails = true
			UserAffiliationsDataService
				.addRoleAndDepartment(
					$scope.affiliationToChange.email,
					$scope.affiliationToChange.role,
					$scope.affiliationToChange.department
				)
				.then () ->
					_reset()
					_getUserEmails()
				.catch () ->
					$scope.ui.hasError = true

		$scope.cancelAffiliationChange = (email) ->
			$scope.affiliationToChange.email = ""
			$scope.affiliationToChange.university = null
			$scope.affiliationToChange.role = null
			$scope.affiliationToChange.department = null
		
		$scope.isChangingAffiliation = (email) ->
			$scope.affiliationToChange.email == email

		$scope.showAddEmailForm = () ->
			$scope.ui.showAddEmailUI = true

		$scope.addNewEmail = () ->
			$scope.ui.isAddingNewEmail = true
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
			addEmailPromise
				.then () -> 
					_reset()
					_getUserEmails()
				.catch () ->
					$scope.ui.hasError = true

		$scope.setDefaultUserEmail = (userEmail) ->
			$scope.ui.isLoadingEmails = true
			UserAffiliationsDataService
				.setDefaultUserEmail userEmail.email
				.then () -> _getUserEmails()
				.catch () -> $scope.ui.hasError = true

		$scope.removeUserEmail = (userEmail) ->
			$scope.ui.isLoadingEmails = true
			userEmailIdx = _.indexOf $scope.userEmails, userEmail
			if userEmailIdx > -1
				$scope.userEmails.splice userEmailIdx, 1
			UserAffiliationsDataService
				.removeUserEmail userEmail.email
				.then () -> _getUserEmails()
				.catch () -> $scope.ui.hasError = true

		$scope.acknowledgeError = () ->
			_reset()
			_getUserEmails()

		_reset = () ->
			$scope.newAffiliation =
				email: ""
				country: null
				university: null
				role: null
				department: null
			$scope.ui = 
				hasError: false
				showChangeAffiliationUI: false
				showManualUniversitySelectionUI: false
				isLoadingEmails: false
				isAddingNewEmail: false
				showAddEmailUI: false
				isValidEmail: false
				isBlacklistedEmail: false
			$scope.affiliationToChange = 
				email: ""
				university: null
				role: null
				department: null
		_reset()

		# Populates the emails table
		_getUserEmails = () ->
			$scope.ui.isLoadingEmails = true
			UserAffiliationsDataService
				.getUserEmails() 
				.then (emails) -> 
					$scope.userEmails = emails
					$scope.ui.isLoadingEmails = false
				.catch () ->
					$scope.ui.hasError = true

		_getUserEmails()

	]