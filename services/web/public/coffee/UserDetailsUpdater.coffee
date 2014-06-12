define ["libs/angular"], (a)->

	angular.element(document).ready ->

		app = angular.module("userProfileInformationApp", [])

		app.controller "UpdateForm", ($scope, $http)->

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

		angular.bootstrap(document, ['userProfileInformationApp'])

