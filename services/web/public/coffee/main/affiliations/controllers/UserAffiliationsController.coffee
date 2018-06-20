define [
	"base"
], (App) ->
	App.controller "UserAffiliationsController", ["$scope", "UserAffiliationsDataService", "$q", ($scope, UserAffiliationsDataService, $q) ->
		$scope.userEmails = []
		$scope.countries = []
		$scope.universities = []
		$scope.newAffiliation =
			email: ""
			country: null
			university: null
			role: null
			department: null
		$scope.showManualUniversitySelectionUI = false
		$scope.isValidEmail = false
		$scope.isBlacklistedEmail = false

		LOCAL_AND_DOMAIN_REGEX = /([^@]+)@(.+)/
		EMAIL_REGEX = /^([A-Za-z0-9_\-\.]+)@([^\.]+)\.([A-Za-z]+)$/

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
			$scope.isValidEmail = EMAIL_REGEX.test userInput  
			$scope.isBlacklistedEmail = false
			if userInputLocalAndDomain.domain?
				$scope.isBlacklistedEmail = UserAffiliationsDataService.isDomainBlacklisted userInputLocalAndDomain.domain

				UserAffiliationsDataService.getUniversityDomainFromPartialDomainInput(userInputLocalAndDomain.domain)
					.then (universityDomain) -> 						
						$scope.showManualUniversitySelectionUI = false
						if userInputLocalAndDomain.domain == universityDomain.hostname
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
			$scope.showManualUniversitySelectionUI = true

		$scope.handleAffiliationFormSubmit = () ->
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
			addEmailPromise.then () -> getUserEmails()
			
		# Populates the emails table
		getUserEmails = () ->
			UserAffiliationsDataService
				.getUserEmails() 
				.then (emails) -> $scope.userEmails = emails
		getUserEmails()

		# Populates the countries dropdown
		UserAffiliationsDataService
			.getCountries()
			.then (countries) -> $scope.countries = countries

		# Populates the universities dropdown (after selecting a country)
		$scope.$watch "newAffiliation.country", (newSelectedCountry, prevSelectedCountry) ->
			if newSelectedCountry? and newSelectedCountry != prevSelectedCountry
				$scope.newAffiliation.university = null
				UserAffiliationsDataService
					.getUniversitiesFromCountry(newSelectedCountry)
					.then (universities) -> $scope.universities = universities
	]