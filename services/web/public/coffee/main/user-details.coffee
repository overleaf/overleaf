define [
	"base"
	"libs/algolia-2.5.2"
], (App, algolia)->
	App.factory "Institutions", ->
		new AlgoliaSearch(window.algolia.institutions.app_id, window.algolia.institutions.api_key).initIndex("institutions")

	App.controller "UserProfileController", ($scope, $modal, $http)->
		$scope.institutions = []
		$http.get("/user/personal_info").success (data)->
			$scope.userInfoForm =
				first_name: data.first_name || ""
				last_name: data.last_name || ""
				role: 	   data.role || ""
				institution: data.institution || ""
				_csrf : window.csrfToken

		$scope.showForm = ->
			$scope.formVisable = true

		$scope.getPercentComplete = ->
			results = _.filter $scope.userInfoForm, (value)-> !value? or value?.length != 0
			results.length * 20

		$scope.$watch "userInfoForm", (value) ->
			if value?
				$scope.percentComplete = $scope.getPercentComplete()
		, true

		$scope.openUserProfileModal = () ->
			$modal.open {
				templateUrl: "userProfileModalTemplate"
				controller: "UserProfileModalController"
				scope: $scope
			}

	App.controller "UserProfileModalController", ($scope, $modalInstance, $http, Institutions) ->
		$scope.roles = ["Student", "Post-graduate student", "Post-doctoral researcher", "Lecturer", "Professor"]

		$modalInstance.result.finally ->
			sendUpdate()

		sendUpdate = ->
			request = $http.post "/user/settings", $scope.userInfoForm
			request.success (data, status)->
			request.error (data, status)->
				console.log "the request failed"

		$scope.updateInstitutionsList = (inputVal)->

			query = $scope.userInfoForm.institution
			if query?.length <= 3
				return #saves us algolia searches
				
			Institutions.search $scope.userInfoForm.institution, (err, response)->
				$scope.institutions = _.map response.hits, (institution)->
					"#{institution.name} (#{institution.domain})"

		$scope.done = () ->
			$modalInstance.close()
