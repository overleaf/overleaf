define [
	"base"
], (App) ->
	App.controller "UserAffiliationsController", ["$scope", "UserAffiliationsDataService", "$q", ($scope, UserAffiliationsDataService, $q) ->
		$scope.countries = []
		$scope.universities = []
		$scope.newAffiliation =
			email: ""
			country: null
			university: null
			role: null
			department: null
			autoDetectMode: true

		LOCAL_AND_DOMAIN_REGEX = /([^@]+)@(.+)/
		EMAIL_REGEX = /^([A-Za-z0-9_\-\.]+)@([^\.]+)\.([A-Za-z]+)$/

		_matchLocalAndDomain = (userEmailInput) ->
			match = userEmailInput?.match LOCAL_AND_DOMAIN_REGEX
			if match?
				{ local: match[1], domain: match[2] }
			else
				{ local: null, domain: null }

		UserAffiliationsDataService.getUserEmails()

		$scope.addUniversityToSelection = (universityName) -> 
			{ name: universityName, isUserSuggested: true }

		$scope.getEmailSuggestion = (userInput) ->
			userInputLocalAndDomain = _matchLocalAndDomain(userInput)
			if userInputLocalAndDomain.domain?
				UserAffiliationsDataService.getUniversityDomainFromPartialDomainInput(userInputLocalAndDomain.domain)
					.then (universityDomain) -> 						
						$scope.newAffiliation.autoDetectMode = true
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
						# If the input is already a full e-mail and we have no suggestions, then the user
						# will need to manually select his institution.
						if userInput.match EMAIL_REGEX
							$scope.newAffiliation.autoDetectMode = false
						$q.reject null
			else
				$scope.newAffiliation.university = null
				$scope.newAffiliation.department = null
				$q.resolve null

		$scope.handleEmailInputBlur = () ->
			if $scope.newAffiliation.autoDetectMode and !$scope.newAffiliation.university and $scope.newAffiliation.email?.match EMAIL_REGEX
				$scope.newAffiliation.autoDetectMode = false

		$scope.selectUniversityManually = () ->
			$scope.newAffiliation.university = null
			$scope.newAffiliation.department = null
			$scope.newAffiliation.autoDetectMode = false

		$scope.handleAffiliationFormSubmit = () ->
			if !$scope.newAffiliation.university?
				UserAffiliationsDataService.addUserEmail(
					$scope.newAffiliation.email,
					$scope.newAffiliation.role,
					$scope.newAffiliation.department
				)
			else
				if $scope.newAffiliation.university.isUserSuggested
					UserAffiliationsDataService.addUserAffiliationWithUnknownUniversity(
						$scope.newAffiliation.email,
						$scope.newAffiliation.university.name, 
						$scope.newAffiliation.country.code,
						$scope.newAffiliation.role,
						$scope.newAffiliation.department
					)
				else
					UserAffiliationsDataService.addUserAffiliation(
						$scope.newAffiliation.email,
						$scope.newAffiliation.university.id
						$scope.newAffiliation.role,
						$scope.newAffiliation.department
					)

		UserAffiliationsDataService
			.getCountries()
			.then (countries) -> $scope.countries = countries

		$scope.$watch "newAffiliation.country", (newSelectedCountry, prevSelectedCountry) ->
			if newSelectedCountry? and newSelectedCountry != prevSelectedCountry
				$scope.newAffiliation.university = null
				UserAffiliationsDataService
					.getUniversitiesFromCountry(newSelectedCountry)
					.then (universities) -> $scope.universities = universities
	]