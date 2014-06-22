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

		$scope.openUploadFileModal = () ->
			$modal.open(
				templateUrl: "uploadFileModalTemplate"
				controller:  "UploadFileModalController"
				scope: $scope
			)

		$scope.orderByFoldersFirst = (entity) ->
			return 0 if entity.type == "folder"
			return 1

		$scope.startRenamingSelected = () ->
			$scope.$broadcast "rename:selected"

		$scope.openDeleteModalForSelected = () ->
			$scope.$broadcast "delete:selected"
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

	App.controller "UploadFileModalController", [
		"$scope", "ide", "$modalInstance", "$timeout",
		($scope,   ide,   $modalInstance,   $timeout) ->
			parent_folder = ide.fileTreeManager.getCurrentFolder()
			$scope.parent_folder_id = parent_folder?.id

			uploadCount = 0
			$scope.onUpload = () ->
				uploadCount++

			$scope.onComplete = (error, name, response) ->
				$timeout (() ->
					uploadCount--
					if uploadCount == 0 and response? and response.success
						$modalInstance.close("done")
				), 250

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]