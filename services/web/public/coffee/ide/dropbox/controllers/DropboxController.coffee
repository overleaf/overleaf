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

	App.controller "DropboxModalController", ($scope, $modalInstance, ide, $timeout) ->
		user_id = ide.$scope.user.id

		$scope.dbState = cachedState
		$scope.dbState.hasDropboxFeature = $scope.project.features.dropbox
		
		calculatePollTime = ->
			ide.socket.emit "getLastTimePollHappned", (err, lastTimePollHappened)=>
				milisecondsSinceLastPoll = new Date().getTime() - lastTimePollHappened
				roundedMinsSinceLastPoll = Math.round(milisecondsSinceLastPoll / ONE_MIN_MILI)

				$scope.dbState.minsTillNextPoll = POLLING_INTERVAL - roundedMinsSinceLastPoll
				$scope.dbState.percentageLeftTillNextPoll = 100 - ((roundedMinsSinceLastPoll / POLLING_INTERVAL) * 100)
				console.log $scope.dbState.percentageLeftTillNextPoll
				$timeout calculatePollTime, 60 * 1000

		ide.socket.emit "getUserDropboxLinkStatus", user_id, (err, status)=>
			if status.registered 
				calculatePollTime()
				$scope.dbState.userIsLinkedToDropbox = true
				$scope.dbState.gotLinkStatus = true
				cachedState = $scope.dbState
		
		$scope.linkToDropbox = ->
			window.open("/user/settings#dropboxSettings")
			$scope.startedLinkProcess = true

		$scope.cancel = () ->
			$modalInstance.dismiss()
