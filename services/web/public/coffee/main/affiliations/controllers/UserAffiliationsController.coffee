define [
	"base"
], (App) ->
	App.controller "UserAffiliationsController", ["$scope", "UserAffiliationsDataService", "$q", "_", ($scope, UserAffiliationsDataService, $q, _) ->
		$scope.userEmails = []
		$scope.countries = []
		$scope.universities = []

		LOCAL_AND_DOMAIN_REGEX = /([^@]+)@(.+)/
		EMAIL_REGEX = /^([A-Za-z0-9_\-\.]+)@([^\.]+)\.([A-Za-z0-9_\-\.]+)([^\.])$/

		_matchLocalAndDomain = (userEmailInput) ->
			match = userEmailInput?.match LOCAL_AND_DOMAIN_REGEX
			if match?
				{ local: match[1], domain: match[2] }
			else
				{ local: null, domain: null }

		$scope.addUniversityToSelection = (universityName) -> 
			{ name: universityName, isUserSuggested: true }

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
				$q.resolve null

		$scope.handleEmailInputBlur = () ->
			# if $scope.newAffiliation.autoDetectMode and !$scope.newAffiliation.university and $scope.newAffiliation.email?.match EMAIL_REGEX
			# 	$scope.newAffiliation.autoDetectMode = false

		$scope.selectUniversityManually = () ->
			$scope.newAffiliation.university = null
			$scope.newAffiliation.department = null
			$scope.ui.showManualUniversitySelectionUI = true

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
			addEmailPromise.then () -> 
				_reset()
				_getUserEmails()

		$scope.setDefaultUserEmail = (email) ->
			$scope.ui.isLoadingEmails = true
			UserAffiliationsDataService
				.setDefaultUserEmail email
				.then () -> _getUserEmails()

		$scope.removeUserEmail = (email) ->
			$scope.ui.isLoadingEmails = true
			UserAffiliationsDataService
				.removeUserEmail email
				.then () -> _getUserEmails()

		$scope.getUniqueUniversityDepartments = () ->
			_.uniq $scope.newAffiliation.university.departments

		_reset = () ->
			$scope.newAffiliation =
				email: ""
				country: null
				university: null
				role: null
				department: null
			$scope.ui = 
				showManualUniversitySelectionUI: false
				isLoadingEmails: false
				isAddingNewEmail: false
				showAddEmailUI: false
				isValidEmail: false
				isBlacklistedEmail: false
		_reset()

		# Populates the emails table
		_getUserEmails = () ->
			$scope.ui.isLoadingEmails = true
			UserAffiliationsDataService
				.getUserEmails() 
				.then (emails) -> 
					$scope.userEmails = emails
					$scope.ui.isLoadingEmails = false
		_getUserEmails()

		# Populates the countries dropdown
		UserAffiliationsDataService
			.getCountries()
			.then (countries) -> $scope.countries = countries

		# Populates the universities dropdown (after selecting a country)
		$scope.$watch "newAffiliation.country", (newSelectedCountry, prevSelectedCountry) ->
			if newSelectedCountry? and newSelectedCountry != prevSelectedCountry
				$scope.newAffiliation.university = null
				$scope.newAffiliation.role = null
				$scope.newAffiliation.department = null
				UserAffiliationsDataService
					.getUniversitiesFromCountry(newSelectedCountry)
					.then (universities) -> $scope.universities = universities
	]