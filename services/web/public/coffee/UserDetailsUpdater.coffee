define ["libs/algolia", "libs/angular", "libs/angular-autocomplete/angular-autocomplete"], (algolia)->

	app = angular.module("userProfileInformationApp", ["autocomplete"])

	app.factory "Institutions", ->
		new AlgoliaSearch("SK53GL4JLY", "75dc5e65794cd47eb7f725e6bb5075be").initIndex("institutions")

	app.controller "UpdateForm", ($scope, $http, Institutions)->
		$scope.institutions = []
		$scope.hidePersonalInfoSection = true

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

		$scope.sendUpdate = ->
			request = $http.post "/user/personal_info", $scope.userInfoForm
			request.success (data, status)->
				console.log "the post worked"
			request.error (data, status)->
				console.log "the request failed"
			$scope.percentComplete = getPercentComplete()

		getPercentComplete = ->
			results = _.filter $scope.userInfoForm, (value)-> value? and value?.length != 0
			results.length * 20

		$scope.updateInstitutionsList = (a)->
			Institutions.search $scope.userInfoForm.institution, (err, response)->
				$scope.institutions = _.pluck response.hits, "name"

	angular.bootstrap(document.getElementById("userProfileInformation"), ['userProfileInformationApp'])

