define ["libs/algolia", "libs/angular", "libs/angular-autocomplete/angular-autocomplete"], (algolia)->

	app = angular.module("userProfileInformationApp", ["autocomplete"])

	app.factory "Institutions", ->
		new AlgoliaSearch("SK53GL4JLY", "1606ccef5b70ac44680b61e6b0285126").initIndex("institutions")

	app.directive "focusInput", ($timeout) ->
		return (scope, element, attr) ->
			scope.$watch attr.focusInput, (value) ->
				if value
					$timeout ->
						element.select()

	app.controller "UpdateForm", ($scope, $http, Institutions)->
		$scope.institutions = []
		$scope.formVisable = false
		$scope.hidePersonalInfoSection = true
		$scope.roles = ["Student", "Post-graduate student", "Post-doctoral researcher", "Lecturer", "Proffessor"]

		$http.get("/user/personal_info").success (data)->
			$scope.userInfoForm =
				first_name: data.first_name
				last_name: data.last_name
				role: 	   data.role
				institution: data.institution
				_csrf : window.csrfToken

			if getPercentComplete() != 100
				$scope.percentComplete = getPercentComplete()
				$scope.hidePersonalInfoSection = false

		$scope.showForm = ->
			$scope.formVisable = true

		$scope.sendUpdate = ->
			request = $http.post "/user/personal_info", $scope.userInfoForm
			request.success (data, status)->
			request.error (data, status)->
				console.log "the request failed"
			$scope.percentComplete = getPercentComplete()

		getPercentComplete = ->
			results = _.filter $scope.userInfoForm, (value)-> value? and value?.length != 0
			results.length * 20

		$scope.updateInstitutionsList = (a)->
			Institutions.search $scope.userInfoForm.institution, (err, response)->
				$scope.institutions = _.map response.hits, (institution)->
					"#{institution.name} <span class='muted'>#{institution.domain}</span>"



	angular.bootstrap(document.getElementById("userProfileInformation"), ['userProfileInformationApp'])

