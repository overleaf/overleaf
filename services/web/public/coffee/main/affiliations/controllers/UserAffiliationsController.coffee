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

		EMAIL_REGEXP = /([^@]+)@(.+)/

		_matchEmail = (email) ->
			match = email.match EMAIL_REGEXP
			if match?
				{ local: match[1], domain: match[2] }
			else
				{ local: null, domain: null }


		$scope.addUniversityToSelection = (universityName) -> 
			{ name: universityName, country_code: $scope.newAffiliation.country.code }

		$scope.getEmailSuggestion = (userInput) ->
			matchedEmail = _matchEmail(userInput)
			if matchedEmail.domain?
				UserAffiliationsDataService.getUniversityDomainFromPartialDomainInput(matchedEmail.domain)
					.then (universityDomain) -> 
						$scope.newAffiliation.university = universityDomain.university.name
						$scope.newAffiliation.department = universityDomain.department
						$q.resolve "#{matchedEmail.local}@#{universityDomain.hostname}"
					.catch () -> 
						$scope.newAffiliation.university = null
						$scope.newAffiliation.department = null
						$q.reject null
			else 
				$q.resolve null

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