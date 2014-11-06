define [
	"base"
	"ide/permissions/PermissionsManager"
], (App, PermissionsManager) ->
	
	POLLING_INTERVAL = 15
	ONE_MIN_MILI = 1000 * 60

	cachedState =
		gotLinkStatus: false
		startedLinkProcess: false
		userIsLinkedToDropbox: false
		hasDropboxFeature: false


	App.controller "DropboxController", ($scope, $modal, ide) ->
		$scope.openDropboxModal = () ->

			$modal.open {
				templateUrl: "dropboxModalTemplate"
				controller: "DropboxModalController"
				scope:$scope
			}

	App.controller "DropboxModalController", ($scope, $modalInstance, ide, $timeout, $http) ->
		user_id = ide.$scope.user.id

		$scope.dbState = cachedState
		$scope.dbState.hasDropboxFeature = $scope.project.features.dropbox

		$http.get("/project/#{ide.project_id}/dropbox/status")
			.success (status) ->
				$scope.dbState.gotLinkStatus = true
				if status.registered
					$scope.dbState.userIsLinkedToDropbox = true
					cachedState = $scope.dbState
		
		$scope.linkToDropbox = ->
			window.open("/user/settings#dropboxSettings")
			$scope.startedLinkProcess = true

		$scope.cancel = () ->
			$modalInstance.dismiss()
