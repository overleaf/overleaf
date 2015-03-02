define [
	"base"
], (App) ->
	App.controller "FileTreeController", ["$scope", "$modal", "ide", ($scope, $modal, ide) ->
		$scope.openNewDocModal = () ->
			$modal.open(
				templateUrl: "newDocModalTemplate"
				controller:  "NewDocModalController"
				resolve: {
					parent_folder: () -> ide.fileTreeManager.getCurrentFolder()
				}
			)

		$scope.openNewFolderModal = () ->
			$modal.open(
				templateUrl: "newFolderModalTemplate"
				controller:  "NewFolderModalController"
				resolve: {
					parent_folder: () -> ide.fileTreeManager.getCurrentFolder()
				}
			)

		$scope.openUploadFileModal = () ->
			$modal.open(
				templateUrl: "uploadFileModalTemplate"
				controller:  "UploadFileModalController"
				scope: $scope
				resolve: {
					parent_folder: () -> ide.fileTreeManager.getCurrentFolder()
				}
			)

		$scope.orderByFoldersFirst = (entity) ->
			return '0' if entity.type == "folder"
			return '1'

		$scope.startRenamingSelected = () ->
			$scope.$broadcast "rename:selected"

		$scope.openDeleteModalForSelected = () ->
			$scope.$broadcast "delete:selected"
	]

	App.controller "NewDocModalController", [
		"$scope", "ide", "$modalInstance", "$timeout", "parent_folder",
		($scope,   ide,   $modalInstance,   $timeout,   parent_folder) ->
			$scope.inputs = 
				name: "name.tex"
			$scope.state =
				inflight: false

			$modalInstance.opened.then () ->
				$timeout () ->
					$scope.$broadcast "open"
				, 200

			$scope.create = () ->
				name = $scope.inputs.name
				if !name? or name.length == 0
					return
				$scope.state.inflight = true
				ide.fileTreeManager
					.createDoc(name, parent_folder)
					.success () ->
						$scope.state.inflight = false
						$modalInstance.close()

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]

	App.controller "NewFolderModalController", [
		"$scope", "ide", "$modalInstance", "$timeout", "parent_folder",
		($scope,   ide,   $modalInstance,   $timeout,   parent_folder) ->
			$scope.inputs = 
				name: "name"
			$scope.state =
				inflight: false

			$modalInstance.opened.then () ->
				$timeout () ->
					$scope.$broadcast "open"
				, 200

			$scope.create = () ->
				name = $scope.inputs.name
				if !name? or name.length == 0
					return
				$scope.state.inflight = true
				$scope.state.inflight = true
				ide.fileTreeManager
					.createFolder(name, parent_folder)
					.success () ->
						$scope.state.inflight = false
						$modalInstance.close()

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]

	App.controller "UploadFileModalController", [
		"$scope", "ide", "$modalInstance", "$timeout", "parent_folder",
		($scope,   ide,   $modalInstance,   $timeout,   parent_folder) ->
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