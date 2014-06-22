define [
	"base"
], (App) ->
	App.controller "FileTreeController", ["$scope", "$modal", ($scope, $modal) ->
		$scope.openNewDocModal = () ->
			$modal.open(
				templateUrl: "newDocModalTemplate"
				controller:  "NewDocModalController"
			)

		$scope.openNewFolderModal = () ->
			$modal.open(
				templateUrl: "newFolderModalTemplate"
				controller:  "NewFolderModalController"
			)

		$scope.orderByFoldersFirst = (entity) ->
			return 0 if entity.type == "folder"
			return 1
	]

	App.controller "NewDocModalController", [
		"$scope", "ide", "$modalInstance", "$timeout",
		($scope,   ide,   $modalInstance,   $timeout) ->
			$scope.inputs = 
				name: "name.tex"
			$scope.state =
				inflight: false

			$modalInstance.opened.then () ->
				$timeout () ->
					$scope.$broadcast "open"
				, 700

			$scope.create = () ->
				$scope.state.inflight = true
				ide.fileTreeManager.createDocInCurrentFolder $scope.inputs.name, (error, doc) ->
					$scope.state.inflight = false
					$modalInstance.close()

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]

	App.controller "NewFolderModalController", [
		"$scope", "ide", "$modalInstance", "$timeout",
		($scope,   ide,   $modalInstance,   $timeout) ->
			$scope.inputs = 
				name: "name"
			$scope.state =
				inflight: false

			$modalInstance.opened.then () ->
				$timeout () ->
					$scope.$broadcast "open"
				, 700

			$scope.create = () ->
				$scope.state.inflight = true
				ide.fileTreeManager.createFolderInCurrentFolder $scope.inputs.name, (error, doc) ->
					$scope.state.inflight = false
					$modalInstance.close()

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]