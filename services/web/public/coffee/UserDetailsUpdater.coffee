
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
			console.log "!!!!!!!"
			$scope.percentComplete = getPercentComplete()
			$scope.hidePersonalInfoSection = false
			
			console.log $scope.percentComplete


	$scope.sendUpdate = ->
		$http.post "/user/personal_info", $scope.userInfoForm
		$scope.percentComplete = getPercentComplete()

	getPercentComplete = ->
		results = _.filter $scope.userInfoForm, (value)-> value? and value?.length != 0
		console.log results.length * 20
		results.length * 20
